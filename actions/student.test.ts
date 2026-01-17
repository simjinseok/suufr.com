import { describe, it, expect, beforeEach } from 'vitest';
import { createStudent, updateStudent } from './student';
import removeStudent from './student';
import { prismaMock } from '../tests/mocks/prisma';
import { setMockUser, clearMockSession } from '../tests/mocks/auth';

describe('createStudent', () => {
  beforeEach(() => {
    setMockUser({ id: 'user-1' });
  });

  it('유효한 데이터로 학생을 생성한다', async () => {
    const mockStudent = {
      id: 1,
      userId: 'user-1',
      name: '홍길동',
      notes: '테스트 메모',
      status: 'pending' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    prismaMock.$transaction.mockImplementation(async (fn) => {
      const txMock = {
        student: {
          create: async () => mockStudent,
        },
        studentStatusHistory: {
          create: async () => ({ id: 1, studentId: 1, status: 'pending', notes: '신규 수강생 등록' }),
        },
      };
      return fn(txMock as any);
    });

    const formData = new FormData();
    formData.append('name', '홍길동');
    formData.append('notes', '테스트 메모');
    formData.append('status', 'pending');

    const result = await createStudent({}, formData);

    expect(result.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it('이름이 비어있으면 에러를 반환한다', async () => {
    const formData = new FormData();
    formData.append('name', '');
    formData.append('notes', '테스트 메모');
    formData.append('status', 'pending');

    const result = await createStudent({}, formData);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.name).toBeDefined();
  });

  it('트랜잭션으로 StudentStatusHistory도 함께 생성한다', async () => {
    const mockStudent = {
      id: 1,
      userId: 'user-1',
      name: '김철수',
      notes: '',
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    let studentCreated = false;
    let historyCreated = false;

    prismaMock.$transaction.mockImplementation(async (fn) => {
      const txMock = {
        student: {
          create: async () => {
            studentCreated = true;
            return mockStudent;
          },
        },
        studentStatusHistory: {
          create: async () => {
            historyCreated = true;
            return { id: 1, studentId: 1, status: 'active', notes: '신규 수강생 등록' };
          },
        },
      };
      return fn(txMock as any);
    });

    const formData = new FormData();
    formData.append('name', '김철수');
    formData.append('notes', '');
    formData.append('status', 'active');

    const result = await createStudent({}, formData);

    expect(result.success).toBe(true);
    expect(studentCreated).toBe(true);
    expect(historyCreated).toBe(true);
  });
});

describe('updateStudent', () => {
  beforeEach(() => {
    setMockUser({ id: 'user-1' });
  });

  it('존재하는 학생 정보를 수정한다', async () => {
    const mockStudent = {
      id: 1,
      userId: 'user-1',
      name: '홍길동',
      notes: '기존 메모',
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    prismaMock.student.findUnique.mockResolvedValue(mockStudent);
    prismaMock.student.update.mockResolvedValue({
      ...mockStudent,
      name: '홍길동 수정',
      notes: '수정된 메모',
    });

    const formData = new FormData();
    formData.append('studentId', '1');
    formData.append('name', '홍길동 수정');
    formData.append('notes', '수정된 메모');

    const result = await updateStudent({ success: false, timestamp: 0 }, formData);

    expect(result.success).toBe(true);
    expect(result.message).toBe('수강생 정보를 수정하였습니다.');
    expect(prismaMock.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          name: '홍길동 수정',
          notes: '수정된 메모',
        }),
      }),
    );
  });

  it('존재하지 않는 학생은 실패한다', async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);

    const formData = new FormData();
    formData.append('studentId', '999');
    formData.append('name', '홍길동');
    formData.append('notes', '메모');

    const result = await updateStudent({ success: false, timestamp: 0 }, formData);

    expect(result.success).toBe(false);
    expect(prismaMock.student.update).not.toHaveBeenCalled();
  });

  it('인증되지 않은 사용자는 실패한다', async () => {
    clearMockSession();

    const formData = new FormData();
    formData.append('studentId', '1');
    formData.append('name', '홍길동');
    formData.append('notes', '메모');

    const result = await updateStudent({ success: false, timestamp: 0 }, formData);

    expect(result.success).toBe(false);
  });
});

describe('removeStudent', () => {
  beforeEach(() => {
    setMockUser({ id: 'user-1' });
  });

  it('학생을 soft delete 한다', async () => {
    const mockStudent = {
      id: 1,
      userId: 'user-1',
      name: '홍길동',
      notes: '',
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    prismaMock.student.findUnique.mockResolvedValue(mockStudent);
    prismaMock.student.update.mockResolvedValue({
      ...mockStudent,
      deletedAt: new Date(),
    });

    const formData = new FormData();
    formData.append('studentId', '1');

    const result = await removeStudent(formData);

    expect(result.success).toBe(true);
    expect(prismaMock.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('존재하지 않는 학생은 실패한다', async () => {
    prismaMock.student.findUnique.mockResolvedValue(null);

    const formData = new FormData();
    formData.append('studentId', '999');

    const result = await removeStudent(formData);

    expect(result.success).toBe(false);
    expect(prismaMock.student.update).not.toHaveBeenCalled();
  });

  it('다른 사용자의 학생은 삭제할 수 없다', async () => {
    // findUnique는 userId 조건으로 조회하므로 다른 사용자의 학생은 조회되지 않음
    prismaMock.student.findUnique.mockResolvedValue(null);

    const formData = new FormData();
    formData.append('studentId', '1');

    const result = await removeStudent(formData);

    expect(result.success).toBe(false);
    expect(prismaMock.student.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
        }),
      }),
    );
  });
});
