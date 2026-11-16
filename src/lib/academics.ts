import { supabase } from "../integrations/supabase/client.ts";
import { createAcademicApi } from "./academicApiFactory.ts";

export * from "./academicApiFactory.ts";

export const academicApi = createAcademicApi(supabase);
