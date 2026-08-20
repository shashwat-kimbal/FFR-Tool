import fs from "fs";

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
  code = code.replace(/_request:/g, "request:");
  if (code.includes("NextRequest") && !code.includes("import { NextRequest")) {
     code = code.replace(/import { NextResponse } from "next\/server";/, 'import { NextRequest, NextResponse } from "next/server";');
  }
  fs.writeFileSync(route, code, "utf-8");
});
