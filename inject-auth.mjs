import fs from "fs";
import path from "path";

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = dir + "/" + file;
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      if (filePath.endsWith("route.ts")) results.push(filePath);
    }
  });
  return results;
}

const routes = walk("app/api");

routes.forEach((route) => {
  let code = fs.readFileSync(route, "utf-8");
  if (code.includes("getGovernanceAccess")) return;

  const authImport = `import { getGovernanceAccess } from "@/app/lib/governance-auth";\n`;
  const authCheck = `  const access = await getGovernanceAccess(request);\n  if (access.kind !== "authorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });\n`;

  // Inject import
  code = authImport + code;

  // Inject into GET
  code = code.replace(/export async function GET\([^)]*request: NextRequest[^)]*\)\s*\{/, (match) => {
    return match + "\n" + authCheck;
  });
  code = code.replace(/export async function GET\(\)\s*\{/, (match) => {
    return "export async function GET(request: NextRequest) {\n" + authCheck;
  });

  // Inject into POST
  code = code.replace(/export async function POST\([^)]*request: NextRequest[^)]*\)\s*\{/, (match) => {
    return match + "\n" + authCheck;
  });

  fs.writeFileSync(route, code, "utf-8");
});
