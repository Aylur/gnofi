import Gio from "gi://Gio"
import { type GType, register } from "gnim/gobject"
import { Picker } from "./Picker"
import Fuse from "fuse.js/basic"

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
      .filter((app) => !!app)
      .filter((app) => !app.get_is_hidden())

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
    return this.fuse.search(text).map((i) => i.item)
  }
}
