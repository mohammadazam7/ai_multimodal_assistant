import { fireEvent, render, screen } from "@testing-library/react";

import { App } from "./App";

vi.mock("./components/CameraTile", () => ({
  CameraTile: ({ label, onRemove }: { label: string; onRemove: () => void }) => (
    <div>
      tile: {label}
      <button onClick={onRemove}>Remove {label}</button>
    </div>
  ),
}));

const health = { status: "ok", model: "yolov8n", device: "cpu", ready: true };

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(health))));
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      enumerateDevices: vi.fn().mockResolvedValue([
        { kind: "videoinput", deviceId: "usb", label: "USB camera", groupId: "g" },
      ]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders the page heading and the server model", async () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Vision client" })).toBeInTheDocument();
  expect(await screen.findByText("yolov8n")).toBeInTheDocument();
  expect(screen.getByText("cpu")).toBeInTheDocument();
});

test("shows when the server is unreachable", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));
  render(<App />);
  expect(await screen.findByText(/Server unreachable: connection refused/)).toBeInTheDocument();
});

test("adds and removes camera tiles", async () => {
  render(<App />);
  await screen.findByRole("option", { name: "USB camera" });

  fireEvent.change(screen.getByRole("combobox"), { target: { value: "usb" } });
  fireEvent.click(screen.getByRole("button", { name: "Add camera" }));
  fireEvent.click(screen.getByRole("button", { name: "Add camera" }));
  expect(screen.getAllByText("tile: USB camera")).toHaveLength(2);
  expect(screen.getByText("2 streams")).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole("button", { name: "Remove USB camera" })[0]!);
  expect(screen.getAllByText("tile: USB camera")).toHaveLength(1);
  expect(screen.getByText("1 stream")).toBeInTheDocument();
});
