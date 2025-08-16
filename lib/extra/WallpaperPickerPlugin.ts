import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { AccumulatorType, getter, property, register, setter, signal } from "gnim/gobject"
import { PickerPlugin } from "../PickerPlugin"
import Fuse from "fuse.js/basic"
import { ls } from "./os"

export namespace WallpaparPickerPlugin {
  export interface SignalSignatures extends PickerPlugin.SignalSignatures<Gio.File> {
    filter(file: Gio.File): boolean
  }

  export interface ConstructorProps extends PickerPlugin.ConstructorProps {
    wallpaper?: Gio.File | null
    lookupDirectory?: string
    includeHidden?: boolean
    recurseLevel?: number
  }
}

@register()
export class WallpaparPickerPlugin extends PickerPlugin<Gio.File> {
  declare $signals: WallpaparPickerPlugin.SignalSignatures

  @property(String) lookupDirectory: string
  @property(Boolean) includeHidden: boolean
  @property(Number) recurseLevel: number

  @setter<null | Gio.File>(Gio.File) set wallpaper(file) {
    if (file !== this.wallpaper) {
      file?.copy_async(
        Gio.File.new_for_path(`${GLib.get_user_config_dir()}/background`),
        Gio.FileCopyFlags.OVERWRITE,
        GLib.PRIORITY_DEFAULT,
        null,
        () => void 0,
        (_, res) => void file.copy_finish(res),
      )
      this.activate("")
      this.notify("wallpaper")
    }
  }

  @getter<null | Gio.File>(Gio.File) get wallpaper() {
    return this._wallpaper
  }

  @signal([Gio.File], Boolean, {
    default: false,
    accumulator: AccumulatorType.FIRST_WINS,
  })
  filter(file: Gio.File): boolean {
    throw file
  }

  private _files = new Array<Gio.File>()
  private _wallpaper: Gio.File | null = null
  private _timeout?: GLib.Source
  private _fuse!: Fuse<Gio.File>

  constructor({
    lookupDirectory = `${GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES)}`,
    recurseLevel = 3,
    includeHidden = false,
    wallpaper = null,
    ...props
  }: WallpaparPickerPlugin.ConstructorProps) {
    super(props)
    this.lookupDirectory = lookupDirectory
    this.recurseLevel = recurseLevel
    this.includeHidden = includeHidden
    this.wallpaper = wallpaper

    // dirty way to run the init after a filter handler has been registered
    setTimeout(() => this.reload())
  }

  reload() {
    const files = ls(this.lookupDirectory, {
      level: this.recurseLevel,
      includeHidden: this.includeHidden,
    })

    this.result = this._files = files.filter((file) => {
      const info = file.query_info(
        Gio.FILE_ATTRIBUTE_STANDARD_CONTENT_TYPE,
        Gio.FileQueryInfoFlags.NONE,
        null,
      )

      const isImage = info.get_content_type()?.startsWith("image/")
      if (!isImage) return false
      return this.filter?.(file) ?? true
    })

    this._fuse = new Fuse(this._files, {
      keys: ["name"],
      getFn(file, path) {
        const name = file.get_basename() ?? ""
        return Array.isArray(path) ? path.map(() => name) : name
      },
    })
  }

  clear(): void {
    super.clear()
    this.result = this._files
  }

  search(text: string): void {
    super.search(text)
    if (this._timeout) clearTimeout(this._timeout)

    this._timeout = setTimeout(() => {
      if (text === "") {
        this.result = this._files
      } else {
        this.result = this._fuse.search(text).map((r) => r.item)
      }
    }, 200)
  }
}
