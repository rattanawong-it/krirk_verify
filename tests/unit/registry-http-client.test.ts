import { describe, expect, it, vi } from "vitest";
import { RegistryError } from "@/lib/integrations/registry/errors";
import { HttpRegistryClient } from "@/lib/integrations/registry/http-client";
import { generateMockStudents, queryMockStudents } from "@/lib/integrations/registry/mock-data";

const students = generateMockStudents(new Date("2026-09-15T00:00:00.000Z"));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup(responses: (() => Response | Promise<Response>)[], options = {}) {
  const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const next = responses.shift();
    if (!next) throw new Error("ไม่มี response สำรองในเทสต์");
    return next();
  });
  const delays: number[] = [];
  const client = new HttpRegistryClient({
    baseUrl: "https://registry.example.ac.th/api/",
    apiKey: "secret-key",
    fetch: fetchMock as unknown as typeof fetch,
    sleep: async (ms) => {
      delays.push(ms);
    },
    ...options,
  });
  return { client, fetchMock, delays };
}

describe("HttpRegistryClient", () => {
  it("ส่ง query + API key และแปลงหน้ารายการได้", async () => {
    const page = queryMockStudents(students, { page: 2, pageSize: 50 });
    const { client, fetchMock } = setup([() => json(page)]);

    const result = await client.listStudents({
      page: 2,
      pageSize: 50,
      updatedSince: new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(result.students).toHaveLength(50);
    expect(result.invalid).toEqual([]);
    expect(result.hasMore).toBe(true);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://registry.example.ac.th/api/students?page=2&pageSize=50&updatedSince=2026-09-01T00%3A00%3A00.000Z",
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer secret-key");
  });

  it("ระเบียนรูปแบบผิดถูกแยกไว้ ไม่ทำให้ทั้งหน้าล้ม", async () => {
    const good = students[0]!;
    const { client } = setup([
      () =>
        json({
          items: [good, { ...good, studentCode: "12AB", citizenId: "123" }],
          page: 1,
          pageSize: 2,
          total: 2,
          hasMore: false,
        }),
    ]);

    const result = await client.listStudents({ page: 1, pageSize: 2 });
    expect(result.students).toHaveLength(1);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0]!.studentCode).toBe("12AB");
  });

  it("retry เมื่อ 503 แบบ exponential backoff แล้วสำเร็จ", async () => {
    const { client, fetchMock, delays } = setup([
      () => json({ error: "down" }, 503),
      () => json({ error: "down" }, 503),
      () => json(students[0]),
    ]);

    await expect(client.getStudent(students[0]!.studentCode)).resolves.toMatchObject({
      studentCode: students[0]!.studentCode,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([500, 1000]);
  });

  it("timeout ครบจำนวน retry แล้วโยน RegistryError TIMEOUT", async () => {
    const timeout = () => {
      throw new DOMException("The operation timed out", "TimeoutError");
    };
    const { client, fetchMock } = setup([timeout, timeout, timeout, timeout]);

    const error = await client.ping().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RegistryError);
    expect(error).toMatchObject({ code: "TIMEOUT", attempts: 4 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("401 ไม่ retry และแปลงเป็น UNAUTHORIZED", async () => {
    const { client, fetchMock } = setup([() => json({ error: "unauthorized" }, 401)]);
    await expect(client.ping()).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("getStudent คืน null เมื่อ 404", async () => {
    const { client } = setup([() => json({ error: "not_found" }, 404)]);
    await expect(client.getStudent("9999999999")).resolves.toBeNull();
  });

  it("response ผิดรูปแบบ → BAD_RESPONSE", async () => {
    const { client } = setup([
      () => json({ data: [] }),
      () => new Response("<html>", { status: 200 }),
    ]);
    await expect(client.listStudents({ page: 1, pageSize: 10 })).rejects.toMatchObject({
      code: "BAD_RESPONSE",
    });
    await expect(client.ping()).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  });

  it("network error ที่ไม่ใช่ timeout → NETWORK", async () => {
    const { client } = setup(
      [
        () => {
          throw new TypeError("fetch failed");
        },
      ],
      { maxRetries: 0 },
    );
    await expect(client.ping()).rejects.toMatchObject({ code: "NETWORK" });
  });
});
