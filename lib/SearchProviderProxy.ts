import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { Variant, Service, iface, methodAsync } from "gnim/dbus"

export namespace SearchProviderProxy {
  export type Item = SearchItem

  export type Props = {
    busName: string
    objectPath: string
    desktopId: string
  }
}

class SearchItem {
  private proxy: SearchProviderProxy

  readonly variant: Record<string, Variant<any>>

  readonly id: string
  readonly name: string
  readonly clipboardText?: string
  readonly description?: string
  readonly gicon?: Gio.Icon | null

  constructor(proxy: SearchProviderProxy, variant: Record<string, Variant<any>>) {
    this.proxy = proxy
    this.variant = variant

    this.id = variant["id"].get_string()[0]
    this.name = variant["name"].get_string()[0]

    if ("description" in variant) {
      this.description = variant["description"].get_string()[0]
    }

    if ("icon" in variant) {
      this.gicon = Gio.Icon.deserialize(variant["icon"])
    } else if ("gicon" in variant) {
      this.gicon = Gio.Icon.new_for_string(variant["gicon"].get_string()[0])
    } else if ("icon-data" in variant) {
      this.gicon = SearchProviderProxy.parseIconData?.(variant["icon-data"])
    }

    if ("clipboardText" in variant) {
      this.clipboardText = variant["clipboardText"].get_string()[0]
    }
  }

  async activate(text?: string) {
    return await this.proxy.activate(this, text)
  }
}

@iface("org.gnome.Shell.SearchProvider2")
export class SearchProviderProxy extends Service {
  static parseIconData?: (variant: Variant<"(iiibiiay)">) => Gio.Icon

  #ready = false
  appInfo?: Gio.DesktopAppInfo

  constructor({ busName, objectPath, desktopId }: SearchProviderProxy.Props) {
    super()

    this.appInfo = Gio.DesktopAppInfo.new(desktopId)

    this.proxy({ name: busName, objectPath })
      .then(() => (this.#ready = true))
      .catch(() =>
        console.error("failed to proxy SearchProvider", busName, objectPath, desktopId),
      )
  }

  @methodAsync(["as"], ["as"])
  async GetInitialResultSet(terms: string[]): Promise<[string[]]> {
    return Promise.reject(terms)
  }

  @methodAsync(["as", "as"], ["as"])
  async GetSubsearchResultSet(
    previousResults: string[],
    terms: string[],
  ): Promise<[string[]]> {
    return Promise.reject([previousResults, terms])
  }

  @methodAsync(["as"], ["aa{sv}"])
  async GetResultMetas(
    identifiers: string[],
  ): Promise<[Array<Record<string, Variant<any>>>]> {
    return Promise.reject(identifiers)
  }

  @methodAsync("s", "as", "u")
  async ActivateResult(identifiers: string, terms: string[], timestamp: number) {
    return Promise.reject([identifiers, terms, timestamp])
  }

  @methodAsync("as", "u")
  async LaunchSearch(terms: string[], timestamp: number) {
    return Promise.reject([terms, timestamp])
  }

  async search(
    text: string,
    limit: number,
  ): Promise<[surplus: number, results: Array<SearchItem>]> {
    if (!this.#ready) return [0, []]

    try {
      // TODO: make use of GetSubsearchResultSet
      const [ids] = await this.GetInitialResultSet([text])
      const [metas] = await this.GetResultMetas(ids.slice(0, limit))
      const items = metas.map((dict) => new SearchItem(this, dict))
      return [Math.max(ids.length - limit, 0), await Promise.all(items)]
    } catch (error) {
      console.error(this.appInfo?.get_id(), error)
      return [0, []]
    }
  }

  async launch(text: string) {
    if (this.#ready) {
      this.LaunchSearch([text], GLib.DateTime.new_now_local().to_unix()).catch(
        console.error,
      )
    }
  }

  async activate(item: SearchItem, text?: string) {
    try {
      await this.ActivateResult(
        item.id,
        text ? [text] : [],
        GLib.DateTime.new_now_local().to_unix(),
      )
    } catch (error) {
      console.error(error)
    }
  }
}

export function findProviders() {
  return GLib.get_system_data_dirs().flatMap((path) => {
    const dirpath = GLib.build_filenamev([path, "gnome-shell", "search-providers"])

    if (!GLib.file_test(dirpath, GLib.FileTest.IS_DIR)) {
      return []
    }

    const dir = Gio.File.new_for_path(dirpath)

    const enumerator = dir.enumerate_children(
      "standard::name,standard::type",
      Gio.FileQueryInfoFlags.NONE,
      null,
    )

    const providers = new Set<string>()

    return [...enumerator].flatMap((info) => {
      const file = enumerator.get_child(info)
      const keyfile = new GLib.KeyFile()
      keyfile.load_from_file(file.get_path()!, GLib.KeyFileFlags.NONE)
      const group = "Shell Search Provider"

      try {
        const version = keyfile.get_string(group, "Version")
        const desktopId = keyfile.get_string(group, "DesktopId")
        const busName = keyfile.get_string(group, "BusName")
        const objectPath = keyfile.get_string(group, "ObjectPath")

        // do I have to check the combination of this three?
        // is it even possible for an app to expose multiple providers?
        const key = desktopId + busName + objectPath

        if (version !== "2") {
          console.warn(
            "Ignoring non version 2 SearchProvider",
            desktopId,
            busName,
            objectPath,
          )
          return []
        }

        if (providers.has(key)) {
          return []
        } else {
          providers.add(key)
        }

        return {
          busName,
          objectPath,
          desktopId,
        }
      } catch (error) {
        console.error(error)
        return []
      }
    })
  })
}
