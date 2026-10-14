import { ApiError, detectImage, fetchHealth } from "./http";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

test("detectImage posts the frame as multipart form data", async () => {
  const body = { detections: [], width: 2, height: 2, model: "null", inference_ms: 1, total_ms: 2 };
  const fetchMock = stubFetch(new Response(JSON.stringify(body), { status: 200 }));

  const response = await detectImage(new Blob(["jpeg"], { type: "image/jpeg" }));

  expect(response).toEqual(body);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/v1/detect");
  expect(init.method).toBe("POST");
  expect((init.body as FormData).get("file")).toBeInstanceOf(Blob);
});

test("FastAPI error detail becomes the ApiError message", async () => {
  stubFetch(new Response(JSON.stringify({ detail: "image too large" }), { status: 413 }));
  await expect(detectImage(new Blob(["x"]))).rejects.toEqual(new ApiError(413, "image too large"));
});

test("non-JSON errors fall back to the status", async () => {
  stubFetch(new Response("<html>bad gateway</html>", { status: 502, statusText: "Bad Gateway" }));
  const error = await fetchHealth().catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(502);
  expect((error as ApiError).message).toBe("Bad Gateway");
});
