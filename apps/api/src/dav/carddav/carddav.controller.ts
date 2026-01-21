import {
  Controller,
  UseGuards,
  Header,
  HttpCode,
  Req,
  Res,
  Param,
  Get,
  Put,
  Delete,
  NotFoundException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Propfind, Report } from '../decorators/http-methods';
import { BasicAuthGuard } from '../auth/basic-auth.guard';
import { CurrentDavSession } from '../auth/dav-session.decorator';
import { DavSession } from '../../app-tokens/app-tokens.service';
import { CarddavService } from './carddav.service';
import { CONTENT_TYPES, DAV_CAPABILITIES } from '../lib/constants';
import { buildMultistatus, parsePropfind, parseReport } from '../lib/xml';
import { compareEtag } from '../lib/etag';

const DAV_HEADER = `${DAV_CAPABILITIES.LEVEL_1}, ${DAV_CAPABILITIES.LEVEL_2}, ${DAV_CAPABILITIES.LEVEL_3}, ${DAV_CAPABILITIES.ADDRESSBOOK}`;

@Controller('dav/addressbooks')
@UseGuards(BasicAuthGuard)
export class CarddavController {
  constructor(private readonly carddavService: CarddavService) {}

  // PROPFIND /dav/addressbooks/:userId/
  @Propfind(':userId')
  @Header('Content-Type', CONTENT_TYPES.XML)
  @Header('DAV', DAV_HEADER)
  @HttpCode(207)
  async propfindAddressbookHome(
    @Param('userId') userId: string,
    @Req() req: Request,
    @CurrentDavSession() session: DavSession,
  ) {
    const body = await this.getRawBody(req);
    const propfindRequest = parsePropfind(body);
    const depth = req.headers['depth'] || '1';

    const responses = [];

    // Addressbook home collection
    const homeProps: Record<string, unknown> = {};
    const requestedProps = propfindRequest.allprop
      ? ['resourcetype', 'displayname', 'current-user-principal']
      : propfindRequest.props || [];

    for (const prop of requestedProps) {
      switch (prop) {
        case 'resourcetype':
          homeProps['D:resourcetype'] = { 'D:collection': '' };
          break;
        case 'displayname':
          homeProps['D:displayname'] = 'Addressbooks';
          break;
        case 'current-user-principal':
          homeProps['D:current-user-principal'] = {
            'D:href': `/dav/principals/${userId}/`,
          };
          break;
        default:
          homeProps[`D:${prop}`] = undefined;
      }
    }

    responses.push({
      href: `/dav/addressbooks/${userId}/`,
      status: 200,
      props: homeProps,
    });

    // Include default addressbook if depth > 0
    if (depth !== '0') {
      const addressbookProps: Record<string, unknown> = {};
      for (const prop of requestedProps) {
        switch (prop) {
          case 'resourcetype':
            addressbookProps['D:resourcetype'] = {
              'D:collection': '',
              'CARD:addressbook': '',
            };
            break;
          case 'displayname':
            addressbookProps['D:displayname'] = `${session.organization.name} 학생`;
            break;
          case 'addressbook-description':
            addressbookProps['CARD:addressbook-description'] = `${session.organization.name} 학생 연락처`;
            break;
          case 'supported-address-data':
            addressbookProps['CARD:supported-address-data'] = {
              'CARD:address-data-type': {
                '@_content-type': 'text/vcard',
                '@_version': '3.0',
              },
            };
            break;
          case 'getctag':
          case 'CS:getctag':
            addressbookProps['CS:getctag'] = `ctag-${Date.now()}`;
            break;
          default:
            addressbookProps[`D:${prop}`] = undefined;
        }
      }

      responses.push({
        href: `/dav/addressbooks/${userId}/default/`,
        status: 200,
        props: addressbookProps,
      });
    }

    return buildMultistatus(responses);
  }

  // PROPFIND /dav/addressbooks/:userId/default/
  @Propfind(':userId/default')
  @Header('Content-Type', CONTENT_TYPES.XML)
  @Header('DAV', DAV_HEADER)
  @HttpCode(207)
  async propfindAddressbook(
    @Param('userId') userId: string,
    @Req() req: Request,
    @CurrentDavSession() session: DavSession,
  ) {
    const body = await this.getRawBody(req);
    const propfindRequest = parsePropfind(body);
    const depth = req.headers['depth'] || '1';

    const responses = [];

    // Addressbook collection
    const addressbookProps: Record<string, unknown> = {};
    const requestedProps = propfindRequest.allprop
      ? [
          'resourcetype',
          'displayname',
          'addressbook-description',
          'supported-address-data',
          'getctag',
        ]
      : propfindRequest.props || [];

    for (const prop of requestedProps) {
      switch (prop) {
        case 'resourcetype':
          addressbookProps['D:resourcetype'] = {
            'D:collection': '',
            'CARD:addressbook': '',
          };
          break;
        case 'displayname':
          addressbookProps['D:displayname'] = `${session.organization.name} 학생`;
          break;
        case 'addressbook-description':
          addressbookProps['CARD:addressbook-description'] = `${session.organization.name} 학생 연락처`;
          break;
        case 'supported-address-data':
          addressbookProps['CARD:supported-address-data'] = {
            'CARD:address-data-type': {
              '@_content-type': 'text/vcard',
              '@_version': '3.0',
            },
          };
          break;
        case 'getctag':
        case 'CS:getctag':
          addressbookProps['CS:getctag'] = `ctag-${Date.now()}`;
          break;
        default:
          addressbookProps[`D:${prop}`] = undefined;
      }
    }

    responses.push({
      href: `/dav/addressbooks/${userId}/default/`,
      status: 200,
      props: addressbookProps,
    });

    // Include contacts if depth > 0
    if (depth !== '0') {
      const students = await this.carddavService.findAllStudents(
        userId,
        session.organization.id,
      );

      for (const student of students) {
        const contactProps: Record<string, unknown> = {};
        for (const prop of requestedProps) {
          switch (prop) {
            case 'resourcetype':
              contactProps['D:resourcetype'] = '';
              break;
            case 'getetag':
              contactProps['D:getetag'] = this.carddavService.generateEtag(student);
              break;
            case 'getcontenttype':
              contactProps['D:getcontenttype'] = CONTENT_TYPES.VCARD;
              break;
            default:
              contactProps[`D:${prop}`] = undefined;
          }
        }

        responses.push({
          href: `/dav/addressbooks/${userId}/default/${student.uuid}.vcf`,
          status: 200,
          props: contactProps,
        });
      }
    }

    return buildMultistatus(responses);
  }

  // REPORT /dav/addressbooks/:userId/default/
  @Report(':userId/default')
  @Header('Content-Type', CONTENT_TYPES.XML)
  @Header('DAV', DAV_HEADER)
  @HttpCode(207)
  async reportAddressbook(
    @Param('userId') userId: string,
    @Req() req: Request,
    @CurrentDavSession() session: DavSession,
  ) {
    const body = await this.getRawBody(req);
    const reportRequest = parseReport(body);

    let students;

    if (reportRequest.type === 'addressbook-multiget' && reportRequest.hrefs) {
      // Extract UUIDs from hrefs
      const uuids = reportRequest.hrefs
        .map((href) => {
          const match = href.match(/([a-f0-9-]+)\.vcf$/);
          return match ? match[1] : null;
        })
        .filter((uuid): uuid is string => uuid !== null);

      students = await this.carddavService.findStudentsByUuids(
        uuids,
        userId,
        session.organization.id,
      );
    }
    else {
      // addressbook-query: return all contacts
      students = await this.carddavService.findAllStudents(
        userId,
        session.organization.id,
      );
    }

    const responses = students.map((student) => {
      const props: Record<string, unknown> = {};

      for (const prop of reportRequest.props || []) {
        switch (prop) {
          case 'getetag':
            props['D:getetag'] = this.carddavService.generateEtag(student);
            break;
          case 'address-data':
            props['CARD:address-data'] = this.carddavService.studentToVcard(student);
            break;
          default:
            props[`D:${prop}`] = undefined;
        }
      }

      return {
        href: `/dav/addressbooks/${userId}/default/${student.uuid}.vcf`,
        status: 200,
        props,
      };
    });

    return buildMultistatus(responses);
  }

  // GET /dav/addressbooks/:userId/default/:uid.vcf
  @Get(':userId/default/:uid.vcf')
  @Header('Content-Type', CONTENT_TYPES.VCARD)
  async getContact(
    @Param('userId') userId: string,
    @Param('uid') uid: string,
    @Res() res: Response,
    @CurrentDavSession() session: DavSession,
  ) {
    const student = await this.carddavService.findStudentByUuid(
      uid,
      userId,
      session.organization.id,
    );

    if (!student) {
      throw new NotFoundException('Contact not found');
    }

    const vcard = this.carddavService.studentToVcard(student);
    const etag = this.carddavService.generateEtag(student);

    res.setHeader('ETag', etag);
    res.send(vcard);
  }

  // PUT /dav/addressbooks/:userId/default/:uid.vcf
  @Put(':userId/default/:uid.vcf')
  async putContact(
    @Param('userId') userId: string,
    @Param('uid') uid: string,
    @Req() req: Request,
    @Res() res: Response,
    @CurrentDavSession() session: DavSession,
  ) {
    const ifMatch = req.headers['if-match'] as string | undefined;
    const body = await this.getRawBody(req);

    const existing = await this.carddavService.findStudentByUuid(
      uid,
      userId,
      session.organization.id,
    );

    if (existing) {
      // Update existing contact
      if (ifMatch) {
        const currentEtag = this.carddavService.generateEtag(existing);
        if (!compareEtag(ifMatch, currentEtag)) {
          res.status(HttpStatus.PRECONDITION_FAILED).send('ETag mismatch');
          return;
        }
      }

      const updated = await this.carddavService.updateStudent(
        uid,
        userId,
        session.organization.id,
        body,
      );

      if (updated) {
        const etag = this.carddavService.generateEtag(updated);
        res.setHeader('ETag', etag);
        res.status(HttpStatus.NO_CONTENT).send();
      }
      else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Failed to update');
      }
    }
    else {
      // New contact creation is not supported (students are created through the app)
      res.status(HttpStatus.FORBIDDEN).send('Creating new contacts is not supported');
    }
  }

  // DELETE /dav/addressbooks/:userId/default/:uid.vcf
  @Delete(':userId/default/:uid.vcf')
  async deleteContact(
    @Param('userId') userId: string,
    @Param('uid') uid: string,
    @Res() res: Response,
    @CurrentDavSession() session: DavSession,
  ) {
    // Deleting contacts is not supported (students should be managed through the app)
    res.status(HttpStatus.FORBIDDEN).send('Deleting contacts is not supported');
  }

  private async getRawBody(req: Request): Promise<string> {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
      });
      req.on('end', () => {
        resolve(data);
      });
      // If body already parsed or empty
      if (req.readable === false) {
        resolve((req as Request & { body?: string }).body || '');
      }
    });
  }
}
