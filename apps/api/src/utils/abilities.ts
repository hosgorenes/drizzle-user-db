import { createMongoAbility, AbilityBuilder, MongoAbility } from "@casl/ability";

export type UserRole = 'anonymous' | 'user' | 'admin';
export type Subjects = 'User' | 'all';
export type Actions = 'read' | 'create' | 'update' | 'delete' | 'manage';

export type UserFields = 'id' | 'firstName' | 'lastName' | 'city' | 'createdAt' | 'updatedAt' | 'email';

type AppAbility = MongoAbility<[Actions, Subjects]>;
export function createUserAbilities(user: any): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.authType === 'apiKey' || user.role === 'anonymous') {
        can('read', 'User');
    }

    if (user.role === 'user') {
        can('read', 'User');
        can('update', 'User');
        can('delete', 'User');
    }

    if (user.role === 'admin') {
        can('manage', 'all');
    }

    return build();
}

export function getSelectableFields(user: any): string[] {
    const allFields = ['id', 'firstName', 'lastName', 'city', 'createdAt', 'updatedAt'];

    if (user.authType === 'apiKey' || user.role === 'anonymous') {
        return ['id', 'firstName', 'lastName'];
    }

    if (user.role === 'user') {
        return allFields;
    }

    if (user.role === 'admin') {
        return allFields;
    }

    return allFields;
}

export function canViewEmails(user: any): boolean {
    return user.role === 'admin';
}