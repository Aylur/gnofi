import Gio from "gi://Gio"
import GLib from "gi://GLib"
import type { Picker } from "../Picker"

export type Request<Action = string, Payload = unknown> = [Action?, Payload?]

/**
 * Utility to log errors through a {@link Picker}.
 */
export function errorStr(error: unknown): string {
  if (typeof error === "string") return error

  if (error instanceof GLib.Error) {
    return `${error.domain}: ${error.message}`
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }

  return `${error}`
}

/** @throws {Error} */
async function read(
  stream: Gio.DataInputStream,
  cancallable: Gio.Cancellable,
): Promise<string> {
  return new Promise((resolve, reject) => {
    stream.read_line_async(GLib.PRIORITY_DEFAULT, cancallable, (_stream, res) => {
      try {
        const [output] = stream.read_line_finish_utf8(res)
        if (typeof output !== "string") {
          reject(Error("failed to read stdin"))
        } else {
          resolve(output)
        }
      } catch (error) {
        reject(error)
      }
    })
  })
}

function recursiveRead(
  stream: Gio.DataInputStream,
  onOutput: (out: string) => void,
  onError: (err: string) => void,
  cancallable: Gio.Cancellable,
) {
  read(stream, cancallable)
    .then((out) => {
      onOutput(out)
      recursiveRead(stream, onOutput, onError, cancallable)
    })
    .catch((error) => {
      if (!cancallable.is_cancelled()) onError(errorStr(error))
    })
}

/** @throws {Error} */
function proc(command: string) {
  const [, cmd] = GLib.shell_parse_argv(command)
  if (cmd === null) throw Error(`shell_parse_argv failed: '${command}'`)

  return Gio.Subprocess.new(
    cmd,
    Gio.SubprocessFlags.STDOUT_PIPE |
      Gio.SubprocessFlags.STDERR_PIPE |
      Gio.SubprocessFlags.STDIN_PIPE,
  )
}

/** @throws {Error} */
function parseRequest(string: string): Request {
  const json = JSON.parse(string)

  if (!Array.isArray(json)) {
    throw Error("invalid request: not a tuple")
  }
  if (json.length > 0 && typeof json[0] !== "string") {
    throw Error("invalid request: action is not a string")
  }

  return json as Request
}

/** @throws {string} */
export async function request(
  cmd: string,
  request: Request,
  cancallable: Gio.Cancellable | null = null,
): Promise<Request> {
  const p = proc(cmd)

  return new Promise((resolve, reject) => {
    p.communicate_utf8_async(JSON.stringify(request), cancallable, (_, res) => {
      try {
        const [, stdout, stderr] = p.communicate_utf8_finish(res)

        if (p.get_successful()) {
          resolve(parseRequest(stdout))
        } else {
          reject(stderr.trim())
        }
      } catch (error) {
        reject(errorStr(error))
      }
    })
  })
}

/** @throws {Error} */
export function subprocess(props: {
  executable: string
  onRequest: (req: Request) => void
  onError: (err: string) => void
}) {
  const { executable, onRequest, onError } = props
  const [, cmd] = GLib.shell_parse_argv(executable)
  if (cmd === null) throw Error(`shell_parse_argv failed: '${executable}'`)

  const cancallable = new Gio.Cancellable()
  const proc = Gio.Subprocess.new(
    cmd,
    Gio.SubprocessFlags.STDOUT_PIPE |
      Gio.SubprocessFlags.STDERR_PIPE |
      Gio.SubprocessFlags.STDIN_PIPE,
  )

  const stdin = new Gio.DataOutputStream({
    baseStream: proc.get_stdin_pipe()!,
    closeBaseStream: true,
  })

  recursiveRead(
    new Gio.DataInputStream({
      baseStream: proc.get_stdout_pipe()!,
      closeBaseStream: true,
    }),
    (out) => {
      try {
        onRequest(parseRequest(out))
      } catch (error) {
        onError(errorStr(error))
      }
    },
    onError,
    cancallable,
  )

  recursiveRead(
    new Gio.DataInputStream({
      baseStream: proc.get_stderr_pipe()!,
      closeBaseStream: true,
    }),
    onError,
    onError,
    cancallable,
  )

  const encoder = new TextEncoder()

  return {
    exit() {
      cancallable.cancel()
      this.request("exit")
      // TODO: force exit after a some time if not exitted
      // proc.force_exit()
    },
    request(...request: Request) {
      stdin.write_bytes_async(
        encoder.encode(JSON.stringify(request) + "\n"),
        GLib.PRIORITY_DEFAULT,
        cancallable,
        (_, res) => {
          try {
            stdin.write_all_finish(res)
          } catch (error) {
            onError(errorStr(error))
          }
        },
      )
    },
  }
}
