import { IS_SAAS } from '@/lib/config/mode';

/**
 * LocalStorage keys for administrative authentication persistence.
 * Namespace-isolated between Self-Hosted and SaaS multi-tenant environments.
 */
export const ADMIN_TOKEN_KEY = IS_SAAS ? 'kovert_saas_admin_token' : 'kovertklaus_admin_token';
export const ADMIN_USER_KEY = IS_SAAS ? 'kovert_saas_admin_user' : 'kovertklaus_admin_user';

/**
 * LocalStorage keys for regular operative authentication persistence.
 */
export const USER_ID_KEY = IS_SAAS ? 'kovert_saas_user_id' : 'kovertklaus_user_id';
export const USER_TOKEN_KEY = IS_SAAS ? 'kovert_saas_user_token' : 'kovertklaus_user_token';
export const USER_INFO_KEY = IS_SAAS ? 'kovert_saas_user_info' : 'kovertklaus_user_info';
