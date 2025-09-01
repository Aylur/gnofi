import Gio from "gi://Gio"
import GLib from "gi://GLib"

export type Request<Action = string, Payload = unknown> = [Action?, Payload?]

function read(
  stream: Gio.DataInputStream,
  cancallable: Gio.Cancellable,
): Promise<string> {
  return new Promise((resolve, reject) => {
    stream.read_line_async(GLib.PRIORITY_DEFAULT, cancallable, (_stream, res) => {
      try {
        const [output] = stream.read_line_finish_utf8(res)
        if (typeof output !== "string") {
          reject(new Error("failed to read stdin"))
        } else {
          resolve(output)
        }
      } catch (error) {
        if (error instanceof GLib.Error) {
          reject(`${error.domain}: ${error.message}`)
        } else if (error instanceof Error) {
          reject(`${error.name}: ${error.message}`)
        } else {
          reject(error)
        }
      }
    })
  })
}

function recursiveRead(
  stream: Gio.DataInputStream,
  onOutput: (out: string) => void,
  onError: (err: unknown) => void,
  cancallable: Gio.Cancellable,
) {
  read(stream, cancallable)
    .then((out) => {
      onOutput(out)
      recursiveRead(stream, onOutput, onError, cancallable)
    })
    .catch((err) => {
      if (!cancallable.is_cancelled()) onError(err)
    })
}

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

export function request(
  cmd: string,
  request: Request,
  cancallable: Gio.Cancellable | null = null,
): Promise<Request> {
  const p = proc(cmd)

  return new Promise((resolve, reject) => {
    p.communicate_utf8_async(JSON.stringify(request), cancallable, (_, res) => {
      const [, stdout, stderr] = p.communicate_utf8_finish(res)
      try {
        if (p.get_successful()) {
          resolve(parseRequest(stdout))
        } else {
          reject(stderr.trim())
        }
      } catch (error) {
        reject(error)
      }
    })
  })
}

export function subprocess(props: {
  executable: string
  onRequest: (req: Request) => void
  onError: (err: unknown) => void
  onLog: (content: unknown) => void
}) {
  const { executable, onRequest, onError, onLog } = props
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
    (out) => onRequest(parseRequest(out)),
    onError,
    cancallable,
  )

  recursiveRead(
    new Gio.DataInputStream({
      baseStream: proc.get_stderr_pipe()!,
      closeBaseStream: true,
    }),
    onLog,
    onError,
    cancallable,
  )

  return {
    exit() {
      cancallable.cancel()
      this.request("exit")
      // TODO: force exit after a some time if not exitted
      // proc.force_exit()
    },
    request(...request: Request) {
      try {
        // FIXME: why does write_all_async not work?
        stdin.write_all(JSON.stringify(request) + "\n", null)
      } catch (error) {
        onError(error)
      }
    },
  }
}
