export function FileSystemRouter(supabase: SupabaseClient): Router {
  const fsRouter = new FileSystemRouterClass(supabase);
  return fsRouter.getRouter();
}
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { CommonValidators, strictValidation } from '../middleware/comprehensive-validation';
import { fetchJsonWithTimeout } from '../utils/fetch-with-timeout';

