import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaArgs = { select?: Record<string, unknown>; data?: Record<string, unknown> };

function spy(result: unknown) {
  const calls: PrismaArgs[] = [];
  const fn = (args: PrismaArgs) => {
    calls.push(args);
    return Promise.resolve(result);
  };
  return Object.assign(fn, { calls });
}

/**
 * These assertions guard the query shape rather than the returned rows: they
 * fail if a `select` is ever dropped, which is how a password hash would
 * start reaching the client.
 */
describe('UsersService response shape', () => {
  function buildService() {
    const user = {
      create: spy({ id: 1 }),
      findMany: spy([]),
      findUnique: spy({ id: 1 }),
      findFirst: spy(null),
      update: spy({ id: 1 }),
    };
    return {
      user,
      service: new UsersService({ user } as unknown as PrismaService),
    };
  }

  it('does not select the password when creating a user', async () => {
    const { service, user } = buildService();
    await service.create('user@example.com', 'correct-horse-battery');
    const select = user.create.calls[0].select ?? {};
    expect(select.password).toBeUndefined();
    expect(Object.keys(select).sort()).toEqual([
      'createdAt',
      'email',
      'emailVerified',
      'id',
      'username',
    ]);
  });

  it('hashes the password before storing it', async () => {
    const { service, user } = buildService();
    await service.create('user@example.com', 'correct-horse-battery');
    const password = user.create.calls[0].data?.password as string;
    expect(password).not.toBe('correct-horse-battery');
    expect(password.startsWith('$2')).toBe(true);
  });

  it('does not select the password when reading the current user', async () => {
    const { service, user } = buildService();
    await service.getMe(1);
    expect(user.findUnique.calls[0].select?.password).toBeUndefined();
  });

  it('does not select the password when updating a profile', async () => {
    const { service, user } = buildService();
    await service.updateProfile(1, { username: 'newname' });
    expect(user.update.calls[0].select?.password).toBeUndefined();
  });

  it('does not select the password when listing users', async () => {
    const { service, user } = buildService();
    await service.findAll();
    expect(user.findMany.calls[0].select?.password).toBeUndefined();
  });
});
