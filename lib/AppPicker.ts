import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { type GType, register } from "gnim/gobject"
import { Picker } from "./Picker"
import Fuse from "fuse.js/basic"

const currentDesktops = GLib.getenv("XDG_CURRENT_DESKTOP")?.split(";")

function hasCommonItem<T>(list1: T[], list2: T[]): boolean {
  const set2 = new Set(list2)
  return list1.some((item) => set2.has(item))
}

function shouldShow(app: Gio.DesktopAppInfo | null): boolean {
  if (!app || app.get_is_hidden()) {
    return false
  }

  if (!currentDesktops) {
    return true
  }

  const notShowIn = app.get_string_list("NotShowIn")

  if (notShowIn.length > 0 && hasCommonItem(notShowIn, currentDesktops)) {
    return false
  }

  const onlyShowIn = app.get_string_list("OnlyShowIn")

  if (onlyShowIn.length > 0 && !hasCommonItem(onlyShowIn, currentDesktops)) {
    return false
  }

  return true
}

@register()
export class AppPicker extends Picker<Gio.DesktopAppInfo> {
  declare static $gtype: GType<AppPicker>

  private fuse!: Fuse<Gio.DesktopAppInfo>

  constructor({ icon = "system-search-symbolic", ...props }: Picker.ConstructorProps) {
    super({ icon, ...props })
    this.reload()
  }

  private reload() {
    const apps = Gio.AppInfo.get_all()
      .filter((app) => app.get_id() && app.get_name())
      .map((app) => Gio.DesktopAppInfo.new(app.get_id()!))
      .filter(shouldShow)

    this.fuse = new Fuse(apps, {
      keys: ["name", "id"],
      getFn(app, path) {
        return Array.isArray(path)
          ? path.map((p) => (p === "id" ? app.get_id()! : app.get_name()))
          : path === "id"
            ? app.get_id()!
            : app.get_name()
      },
    })
  }

  clear(): void {
    super.clear()
    this.result = []
    this.reload()
  }

  activate(text: string): void {
    super.activate(text)
    this.search(text).at(0)?.launch([], null)
  }

  search(text: string): Array<Gio.DesktopAppInfo> {
    super.search(text)
    return (this.result = this.fuse.search(text).map((i) => i.item))
  }
}
