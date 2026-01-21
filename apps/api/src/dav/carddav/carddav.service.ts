import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { studentToVcard, parseVcard } from '../lib/vcard';
import { generateEtag } from '../lib/etag';

@Injectable()
export class CarddavService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllStudents(userId: string, organizationId: number) {
    return this.prisma.student.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findStudentByUuid(uuid: string, userId: string, organizationId: number) {
    return this.prisma.student.findFirst({
      where: {
        uuid,
        organizationId,
        deletedAt: null,
      },
    });
  }

  async findStudentsByUuids(uuids: string[], userId: string, organizationId: number) {
    return this.prisma.student.findMany({
      where: {
        uuid: { in: uuids },
        organizationId,
        deletedAt: null,
      },
    });
  }

  async updateStudent(
    uuid: string,
    userId: string,
    organizationId: number,
    vcardData: string,
  ) {
    const student = await this.findStudentByUuid(uuid, userId, organizationId);
    if (!student) return null;

    const parsed = parseVcard(vcardData);

    const updateData: { name?: string; phone?: string | null; email?: string | null; notes?: string } = {};

    if (parsed.name) {
      updateData.name = parsed.name;
    }

    if (parsed.phone !== undefined) {
      updateData.phone = parsed.phone || null;
    }

    if (parsed.email !== undefined) {
      updateData.email = parsed.email || null;
    }

    if (parsed.notes !== undefined) {
      updateData.notes = parsed.notes;
    }

    return this.prisma.student.update({
      where: { id: student.id },
      data: updateData,
    });
  }

  studentToVcard(student: Awaited<ReturnType<typeof this.findStudentByUuid>>) {
    if (!student) return null;
    return studentToVcard(student);
  }

  generateEtag(student: { id: number; updatedAt: Date }) {
    return generateEtag(student.id, student.updatedAt);
  }
}
