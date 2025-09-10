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

function key(app: Gio.DesktopAppInfo, key: string) {
  switch (key) {
    case "name":
      return app.get_name()
    case "id":
      return app.get_id()!
    case "generic-name":
      return app.get_generic_name() ?? ""
    case "keywords":
      return app.get_keywords()
    default:
      throw Error
  }
}

@register()
export class AppPicker extends Picker<Gio.DesktopAppInfo> {
  declare static $gtype: GType<AppPicker>

  private fuse = new Fuse(new Array<Gio.DesktopAppInfo>(), {
    keys: ["name", "id", "generic-name", "keywords"],
    getFn(app, path) {
      return Array.isArray(path) ? path.flatMap((p) => key(app, p)) : key(app, path)
    },
  })

  constructor({ icon = "system-search-symbolic", ...props }: Picker.ConstructorProps) {
    super({ icon, ...props })
    this.reload()
  }

  private reload() {
    this.fuse.setCollection(
      Gio.AppInfo.get_all()
        .filter((app) => app.get_id() && app.get_name())
        .map((app) => Gio.DesktopAppInfo.new(app.get_id()!))
        .filter(shouldShow),
    )
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
