const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function reloadSchemaCache() {
  try {
    console.log("Attempting to reload schema cache...");

    // Execute NOTIFY command to reload PostgREST schema cache
    const { error } = await supabase.rpc("exec_sql", {
      sql: "NOTIFY pgrst, 'reload schema';",
    });

    if (error) {
      console.error("Error reloading schema cache:", error);
    } else {
      console.log("Schema cache reload signal sent successfully!");
    }
  } catch (error) {
    console.error("Failed to reload schema cache:", error);
  }
}

// Create the exec_sql function if it doesn't exist
async function createExecSqlFunction() {
  try {
    const { error } = await supabase.rpc("exec_sql", {
      sql: `
        CREATE OR REPLACE FUNCTION exec_sql(sql text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE sql;
        END;
        $$;
      `,
    });

    if (error) {
      console.log(
        "exec_sql function might already exist or there was an error:",
        error.message
      );
    } else {
      console.log("exec_sql function created successfully");
    }
  } catch (error) {
    console.log("Note: Could not create exec_sql function:", error.message);
  }
}

async function main() {
  await createExecSqlFunction();
  await reloadSchemaCache();
}

main();
