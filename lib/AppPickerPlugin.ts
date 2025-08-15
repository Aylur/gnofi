import Gio from "gi://Gio"
import { type GType, ParamSpec, property, register } from "gnim/gobject"
import { PickerPlugin } from "./PickerPlugin"
import Fuse from "fuse.js/basic"

export namespace AppPickerPlugin {
  export interface ConstructorProps extends PickerPlugin.ConstructorProps {
    showHidden?: boolean
  }

  export interface SignalSignatures
    extends PickerPlugin.SignalSignatures<Gio.DesktopAppInfo> {
    "notify::show-hidden": (pspec: ParamSpec<boolean>) => void
  }
}

@register()
export class AppPickerPlugin extends PickerPlugin<Gio.DesktopAppInfo> {
  declare static $gtype: GType<AppPickerPlugin>
  declare $signals: AppPickerPlugin.SignalSignatures

  @property(Boolean) showHidden: boolean

  private fuse!: Fuse<Gio.DesktopAppInfo>

  constructor({
    showHidden = false,
    icon = "system-search-symbolic",
    ...props
  }: AppPickerPlugin.ConstructorProps) {
    super({ icon, ...props })
    this.showHidden = showHidden
    this.reload()
  }

  private reload() {
    const apps = Gio.AppInfo.get_all()
      .filter((app) => app.get_id() && app.get_name())
      .map((app) => Gio.DesktopAppInfo.new(app.get_id()!))
      .filter((app) => !!app)

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
    const res = this.fuse.search(text).map((i) => i.item)
    return (this.result = this.showHidden
      ? res
      : res.filter((app) => !app.get_nodisplay() && !app.get_is_hidden()))
  }
}
