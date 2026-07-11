import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(process.env.HOME, "Downloads/mi/assets");
const dest = path.join(root, "public/assets");

async function main() {
  await mkdir(path.join(dest, "audio"), { recursive: true });
  await mkdir(path.join(dest, "scene"), { recursive: true });
  await mkdir(path.join(dest, "icons"), { recursive: true });

  await cp(path.join(srcRoot, "audio"), path.join(dest, "audio"), {
    recursive: true,
  });
  for (const f of await readdir(path.join(srcRoot, "scene"))) {
    await cp(path.join(srcRoot, "scene", f), path.join(dest, "scene", f));
  }
  for (const f of await readdir(path.join(srcRoot, "icons"))) {
    if (f.endsWith(".json")) {
      await cp(path.join(srcRoot, "icons", f), path.join(dest, f));
    } else {
      await cp(path.join(srcRoot, "icons", f), path.join(dest, "icons", f));
    }
  }
  await cp(
    path.join(srcRoot, "scene/prebuilt_scene_config.json"),
    path.join(dest, "prebuilt_scene_config.json"),
  );

  const sceneCfg = JSON.parse(
    await readFile(path.join(dest, "prebuilt_scene_config.json"), "utf8"),
  );
  await writeFile(
    path.join(dest, "README.md"),
    `Copied from Xiaomi unpack. Scenes: ${sceneCfg.map((s) => s.title).join(", ")}\n`,
  );
  console.log("assets copied to public/assets");
}

main();
