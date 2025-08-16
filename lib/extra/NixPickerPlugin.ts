import GLib from "gi://GLib?version=2.0"
import { property, register } from "gnim/gobject"
import { PickerPlugin } from "./PickerPlugin"
import { execAsync, exec, writeFileAsync } from "./os"

// FIXME: support other achitectures
const PREFIX = "legacyPackages.x86_64-linux."
const NIXPKGS = `${GLib.get_user_runtime_dir()}/marble/nixpkgs.json`

type Nixpkg = {
  description: string
  pname: string
  version: string
}

export namespace NixPickerPlugin {
  export interface Props extends PickerPlugin.ConstructorProps {
    maxItems?: number
    pkgs?: string
    enableCompletion?: boolean
  }
}

@register()
export class NixPickerPlugin extends PickerPlugin<Nixpkg> {
  @property(Number) maxItems: number
  @property(String) pkgs: string
  @property(Boolean) enableCompletion: boolean

  private nixpkgs: Record<string, Nixpkg> = {}

  constructor({
    maxItems = 8,
    pkgs = "nixpkgs",
    enableCompletion = false,
    ...props
  }: NixPickerPlugin.Props) {
    super(props)

    this.maxItems = maxItems
    this.pkgs = pkgs
    this.enableCompletion = enableCompletion

    if (!GLib.find_program_in_path("fzf")) {
      throw Error("missing dependency: fzf")
    }

    execAsync(`nix search ${pkgs} ^ --json`).then((json) => {
      const pkgs = JSON.parse(json) as Record<string, Nixpkg>

      const list = Object.keys(pkgs)
        .map((name) => name.replace(PREFIX, ""))
        .join("\n")

      writeFileAsync(NIXPKGS, list).then(() => {
        for (const [name, pkg] of Object.entries(pkgs)) {
          this.nixpkgs[name.replace(PREFIX, "")] = {
            pname: pkg.pname,
            version: pkg.version,
            description: pkg.description,
          }
        }
      })
    })
  }

  search(search: string): void {
    super.search(search)
    execAsync([
      "bash",
      "-c",
      `cat ${NIXPKGS} | fzf -f "${search}" | head -n ${this.maxItems}`,
    ])
      .then((out) => {
        this.result =
          Object.entries(this.nixpkgs).length === 0
            ? []
            : out
                .split("\n")
                .map((key) => key in this.nixpkgs && this.nixpkgs[key])
                .filter((i) => typeof i === "object")
      })
      .catch((error) => {
        this.result = []
        console.error(error)
      })
  }

  activate(text: string): void {
    super.activate(text)
    const [pkg, ...args] = text.split(/\s+/)
    execAsync(`systemd-run --user nix run ${this.pkgs}#${pkg} -- ${args.join(" ")}`)
      .then(print)
      .catch(console.error)
  }

  complete(text: string): string {
    if (this.enableCompletion) {
      try {
        const res = exec(["bash", "-c", `cat ${NIXPKGS} | fzf -f "${text}" | head -n 1`])
        return res === text ? "" : res
      } catch (error) {
        console.error(error)
      }
    }
    return ""
  }
}
