import { fireEvent, render, screen } from "@testing-library/react";

import { CameraTile } from "./CameraTile";

function stubMedia(getUserMedia: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("shows the camera error when access is denied", async () => {
  stubMedia(() => Promise.reject(new Error("Permission denied")));
  render(<CameraTile deviceId="cam" label="Desk camera" onRemove={() => {}} />);

  expect(await screen.findByRole("alert")).toHaveTextContent("Permission denied");
  expect(screen.getByText("error")).toBeInTheDocument();
});

test("stops the camera tracks and calls onRemove", async () => {
  const track = { stop: vi.fn() };
  const media = { getTracks: () => [track] } as unknown as MediaStream;
  stubMedia(() => Promise.resolve(media));
  vi.stubGlobal(
    "WebSocket",
    class {
      binaryType = "blob";
      onclose: ((e: { reason: string }) => void) | null = null;
      close() {
        this.onclose?.({ reason: "" });
      }
    },
  );
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  const onRemove = vi.fn();

  const { unmount } = render(<CameraTile deviceId="cam" label="Desk camera" onRemove={onRemove} />);
  expect(await screen.findByText("connecting")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Remove Desk camera" }));
  expect(onRemove).toHaveBeenCalled();

  unmount();
  expect(track.stop).toHaveBeenCalled();
});
