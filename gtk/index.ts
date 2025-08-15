import GdkPixbuf from "gi://GdkPixbuf"
import Gdk from "gi://Gdk?version=4.0"
import { Picker } from "../lib/Picker"
import { SearchProviderProxy } from "../lib/SearchProviderProxy"

Picker.keys = Gdk
SearchProviderProxy.parseIconData = function (variant) {
  const [w, h, rs, alpha, bps, , data] = variant.deepUnpack()
  return GdkPixbuf.Pixbuf.new_from_bytes(
    data,
    GdkPixbuf.Colorspace.RGB,
    alpha,
    bps,
    w,
    h,
    rs,
  )
}

export { Picker }
export { Entry, KeyController } from "./Entry"
export { AppPickerPlugin } from "../lib/AppPickerPlugin"
export { PickerPlugin } from "../lib/PickerPlugin"
export { SearchPickerPlugin } from "../lib/SearchPickerPlugin"
export { HelpPickerPlugin } from "../lib/HelpPickerPlugin"
export { PickerCollectionPlugin } from "../lib/PickerCollectionPlugin"
export { NixPickerPlugin } from "../lib/NixPickerPlugin"
export { WallpaparPickerPlugin } from "../lib/WallpaperPickerPlugin"
export { findProviders } from "../lib/SearchProviderProxy"
