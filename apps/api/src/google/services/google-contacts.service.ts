import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleService } from '../google.service';
import type { GoogleContact, SyncResult } from '../dto';

const PEOPLE_API_BASE = 'https://people.googleapis.com/v1';

// Fields to request from People API
const PERSON_FIELDS = 'names,phoneNumbers,emailAddresses,organizations,userDefined';

interface ConnectionsResponse {
  connections?: GoogleContact[];
  nextSyncToken?: string;
  nextPageToken?: string;
  totalPeople?: number;
}

@Injectable()
export class GoogleContactsService {
  private readonly logger = new Logger(GoogleContactsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleService: GoogleService,
  ) {}

  /**
   * Sync all students to Google Contacts
   */
  async syncAll(userId: string, accessToken: string): Promise<SyncResult> {
    const result: SyncResult = { created: 0, updated: 0, deleted: 0, errors: 0 };

    // Get all students for this user
    const students = await this.prisma.student.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        organization: true,
        googleContact: true,
      },
    });

    // Push each student to Google Contacts
    for (const student of students) {
      try {
        if (student.googleContact) {
          // Update existing contact
          await this.updateContact(
            student.googleContact.googleResourceName,
            this.studentToContact(student),
            accessToken,
          );
          await this.prisma.studentGoogleContact.update({
            where: { id: student.googleContact.id },
            data: { lastSyncedAt: new Date(), syncStatus: 'synced', errorMessage: null },
          });
          result.updated++;
        }
        else {
          // Create new contact
          const contact = await this.createContact(this.studentToContact(student), accessToken);
          if (contact.resourceName) {
            await this.prisma.studentGoogleContact.create({
              data: {
                studentId: student.id,
                userId,
                googleResourceName: contact.resourceName,
                etag: contact.etag,
                lastSyncedAt: new Date(),
                syncStatus: 'synced',
              },
            });
            result.created++;
          }
        }
      }
      catch (error) {
        this.logger.error(`Failed to sync student ${student.uuid}:`, error);
        result.errors++;
        if (student.googleContact) {
          await this.prisma.studentGoogleContact.update({
            where: { id: student.googleContact.id },
            data: { syncStatus: 'error', errorMessage: String(error) },
          });
        }
      }
    }

    // Handle deleted students (soft deleted in Suufr but still have Google contacts)
    const orphanedContacts = await this.prisma.studentGoogleContact.findMany({
      where: {
        userId,
        student: {
          deletedAt: { not: null },
        },
      },
    });

    for (const mapping of orphanedContacts) {
      try {
        await this.deleteContact(mapping.googleResourceName, accessToken);
        await this.prisma.studentGoogleContact.delete({ where: { id: mapping.id } });
        result.deleted++;
      }
      catch (error) {
        this.logger.error(`Failed to delete orphaned contact ${mapping.googleResourceName}:`, error);
        result.errors++;
      }
    }

    // Update last sync time
    await this.googleService.updateSyncToken(userId, { lastContactsSyncAt: new Date() });

    return result;
  }

  /**
   * Push a single student to Google Contacts (called on student create/update)
   */
  async pushStudent(studentId: number, userId: string): Promise<void> {
    const accessToken = await this.googleService.getAccessToken(userId);
    if (!accessToken) {
      this.logger.debug(`No Google connection for user ${userId}, skipping push`);
      return;
    }

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        userId,
        deletedAt: null,
      },
      include: {
        organization: true,
        googleContact: true,
      },
    });

    if (!student) {
      return;
    }

    try {
      const contactData = this.studentToContact(student);

      if (student.googleContact) {
        const updated = await this.updateContact(
          student.googleContact.googleResourceName,
          contactData,
          accessToken,
        );
        await this.prisma.studentGoogleContact.update({
          where: { id: student.googleContact.id },
          data: {
            etag: updated.etag,
            lastSyncedAt: new Date(),
            syncStatus: 'synced',
            errorMessage: null,
          },
        });
      }
      else {
        const contact = await this.createContact(contactData, accessToken);
        if (contact.resourceName) {
          await this.prisma.studentGoogleContact.create({
            data: {
              studentId: student.id,
              userId,
              googleResourceName: contact.resourceName,
              etag: contact.etag,
              lastSyncedAt: new Date(),
              syncStatus: 'synced',
            },
          });
        }
      }
    }
    catch (error) {
      this.logger.error(`Failed to push student ${studentId}:`, error);
      if (student.googleContact) {
        await this.prisma.studentGoogleContact.update({
          where: { id: student.googleContact.id },
          data: { syncStatus: 'error', errorMessage: String(error) },
        });
      }
    }
  }

  /**
   * Delete a student from Google Contacts (called on student delete)
   */
  async deleteStudent(studentId: number, userId: string): Promise<void> {
    const accessToken = await this.googleService.getAccessToken(userId);
    if (!accessToken) {
      return;
    }

    const mapping = await this.prisma.studentGoogleContact.findUnique({
      where: { studentId },
    });

    if (!mapping) {
      return;
    }

    try {
      await this.deleteContact(mapping.googleResourceName, accessToken);
      await this.prisma.studentGoogleContact.delete({ where: { id: mapping.id } });
    }
    catch (error) {
      this.logger.error(`Failed to delete student ${studentId} from Google:`, error);
    }
  }

  /**
   * Pull changes from Google Contacts (incremental sync)
   */
  async pullChanges(userId: string, accessToken: string): Promise<SyncResult> {
    const syncTokenRecord = await this.googleService.getSyncToken(userId);
    const result: SyncResult = { created: 0, updated: 0, deleted: 0, errors: 0 };
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({
        personFields: PERSON_FIELDS,
        pageSize: '100',
      });

      if (syncTokenRecord?.contactsSyncToken && !pageToken) {
        params.set('syncToken', syncTokenRecord.contactsSyncToken);
        params.set('requestSyncToken', 'true');
      }
      else {
        params.set('requestSyncToken', 'true');
      }

      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const response = await fetch(
        `${PEOPLE_API_BASE}/people/me/connections?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (response.status === 410) {
        // Sync token expired, need full sync
        await this.googleService.updateSyncToken(userId, { contactsSyncToken: null });
        return this.syncAll(userId, accessToken);
      }

      if (!response.ok) {
        throw new Error(`Failed to list contacts: ${response.status}`);
      }

      const data = await response.json() as ConnectionsResponse;

      for (const contact of data.connections ?? []) {
        try {
          await this.processGoogleContact(contact, userId);
          result.updated++;
        }
        catch (error) {
          this.logger.error(`Failed to process contact ${contact.resourceName}:`, error);
          result.errors++;
        }
      }

      pageToken = data.nextPageToken;

      if (data.nextSyncToken) {
        await this.googleService.updateSyncToken(userId, {
          contactsSyncToken: data.nextSyncToken,
          lastContactsSyncAt: new Date(),
        });
      }
    } while (pageToken);

    return result;
  }

  private async processGoogleContact(contact: GoogleContact, userId: string): Promise<void> {
    if (!contact.resourceName) {
      return;
    }

    // Check if this contact has a Suufr student UUID in userDefined fields
    const suufrUuid = contact.userDefined?.find(ud => ud.key === 'suufrStudentUuid')?.value;
    if (!suufrUuid) {
      return; // Not a Suufr contact
    }

    const student = await this.prisma.student.findFirst({
      where: {
        uuid: suufrUuid,
        userId,
        deletedAt: null,
      },
      include: { googleContact: true },
    });

    if (!student) {
      return;
    }

    // Update student from Google contact
    const updateData: {
      name?: string;
      phone?: string | null;
      email?: string | null;
    } = {};

    const displayName = contact.names?.[0]?.displayName;
    if (displayName) {
      updateData.name = displayName;
    }

    const phone = contact.phoneNumbers?.[0]?.value;
    updateData.phone = phone;

    const email = contact.emailAddresses?.[0]?.value;
    updateData.email = email;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.student.update({
        where: { id: student.id },
        data: updateData,
      });
    }

    // Update or create mapping
    if (student.googleContact) {
      await this.prisma.studentGoogleContact.update({
        where: { id: student.googleContact.id },
        data: {
          etag: contact.etag,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
        },
      });
    }
    else {
      await this.prisma.studentGoogleContact.create({
        data: {
          studentId: student.id,
          userId,
          googleResourceName: contact.resourceName,
          etag: contact.etag,
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
        },
      });
    }
  }

  private studentToContact(student: {
    uuid: string;
    name: string;
    phone: string | null;
    email: string | null;
    status: string;
    organization: { name: string };
  }): GoogleContact {
    const contact: GoogleContact = {
      names: [{ displayName: student.name }],
      userDefined: [
        { key: 'suufrStudentUuid', value: student.uuid },
        { key: 'suufrStatus', value: student.status },
      ],
    };

    if (student.phone) {
      contact.phoneNumbers = [{ value: student.phone, type: 'mobile' }];
    }

    if (student.email) {
      contact.emailAddresses = [{ value: student.email, type: 'work' }];
    }

    if (student.organization.name) {
      contact.organizations = [{ name: student.organization.name }];
    }

    return contact;
  }

  private async createContact(contact: GoogleContact, accessToken: string): Promise<GoogleContact> {
    const response = await fetch(`${PEOPLE_API_BASE}/people:createContact`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contact),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create contact: ${error}`);
    }

    return response.json() as Promise<GoogleContact>;
  }

  private async updateContact(
    resourceName: string,
    contact: GoogleContact,
    accessToken: string,
  ): Promise<GoogleContact> {
    // First get the current contact to get etag
    const getResponse = await fetch(
      `${PEOPLE_API_BASE}/${resourceName}?personFields=${PERSON_FIELDS}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!getResponse.ok) {
      if (getResponse.status === 404) {
        // Contact was deleted, create a new one
        return this.createContact(contact, accessToken);
      }
      throw new Error(`Failed to get contact: ${getResponse.status}`);
    }

    const currentContact = await getResponse.json() as GoogleContact;

    const response = await fetch(
      `${PEOPLE_API_BASE}/${resourceName}:updateContact?updatePersonFields=${PERSON_FIELDS}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...contact,
          etag: currentContact.etag,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update contact: ${error}`);
    }

    return response.json() as Promise<GoogleContact>;
  }

  private async deleteContact(resourceName: string, accessToken: string): Promise<void> {
    const response = await fetch(
      `${PEOPLE_API_BASE}/${resourceName}:deleteContact`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    // 404 is ok - contact already deleted
    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Failed to delete contact: ${error}`);
    }
  }
}
