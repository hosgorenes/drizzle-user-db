import { createMongoAbility, AbilityBuilder, MongoAbility } from "@casl/ability";

export type UserRole = 'anonymous' | 'user' | 'admin';
export type Subjects = 'User' | 'all';
export type Actions = 'read' | 'create' | 'update' | 'delete' | 'manage';

type AppAbility = MongoAbility<[Actions, Subjects]>;
export function createUserAbilities(user: any): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.authType === 'apiKey' || user.role === 'anonymous') {
        can('read', 'User');
    }
    if (user.role === 'user') {
        can('read', 'User');
        can('update', 'User', { id: user.id });
        can('delete', 'User', { id: user.id });
    }

    if (user.role === 'admin') {
        can('manage', 'all');
    }

    return build();
}
