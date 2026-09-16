import { describe, expect, it } from "vitest";
import {
  auditRetentionCutoff,
  emailLogRetentionCutoff,
  requestRetentionCutoff,
} from "@/lib/retention/cutoffs";
import { CSV_BOM, csvCell, csvRow } from "@/lib/utils/csv";
import { settingsFormSchema, toSettingsForm } from "@/lib/validations/settings";

const validForm = {
  autoApproveEnabled: true,
  monthlyReportEnabled: false,
  queueDigestEnabled: true,
  slaHours: "24",
  userPerHour: "30",
  ipPerHour: "60",
  batchRowsPerDay: "500",
  maxFailedLogins: "5",
  retentionYears: "5",
  auditRetentionYears: "10",
  emailLogRetentionDays: "180",
  linkExpiresDays: "90",
  announcementTh: "  ปิดปรับปรุงระบบ 20 ก.ย.  ",
  announcementEn: "",
};

describe("ตั้งค่าระบบ (F-AUD-06)", () => {
  it("แปลงปีเป็นวัน ตัดช่องว่าง และแปลงตัวเลขจากฟอร์ม", () => {
    const parsed = settingsFormSchema.parse(validForm);
    expect(parsed.retentionDays).toBe(1825);
    expect(parsed.slaHours).toBe(24);
    expect(parsed.announcementTh).toBe("ปิดปรับปรุงระบบ 20 ก.ย.");
    expect(parsed).not.toHaveProperty("retentionYears");
  });

  it("toSettingsForm แปลงกลับเป็นปีได้ค่าเดิม", () => {
    const parsed = settingsFormSchema.parse(validForm);
    expect(toSettingsForm(parsed).retentionYears).toBe(5);
  });

  it("ปฏิเสธค่านอกช่วง และ audit ที่เก็บสั้นกว่าคำขอ", () => {
    const tooFew = settingsFormSchema.safeParse({ ...validForm, maxFailedLogins: "1" });
    expect(tooFew.error?.issues[0]).toMatchObject({
      path: ["maxFailedLogins"],
      message: "settings.errors.range",
    });

    const decimal = settingsFormSchema.safeParse({ ...validForm, slaHours: "1.5" });
    expect(decimal.error?.issues[0]?.message).toBe("settings.errors.integer");

    const shortAudit = settingsFormSchema.safeParse({
      ...validForm,
      retentionYears: "8",
      auditRetentionYears: "5",
    });
    expect(shortAudit.error?.issues[0]).toMatchObject({
      path: ["auditRetentionYears"],
      message: "settings.errors.auditShorter",
    });
  });

  it("ประวัติอีเมล: แปลงเป็นตัวเลข · ต่ำกว่า 30 วันไม่ได้ · ต้องไม่นานกว่าระยะเก็บคำขอ", () => {
    expect(settingsFormSchema.parse(validForm).emailLogRetentionDays).toBe(180);

    const tooShort = settingsFormSchema.safeParse({ ...validForm, emailLogRetentionDays: "7" });
    expect(tooShort.error?.issues[0]).toMatchObject({
      path: ["emailLogRetentionDays"],
      message: "settings.errors.range",
    });

    // เก็บคำขอ 1 ปี (365 วัน) แต่เก็บอีเมล 400 วัน → payload อีเมลจะอยู่นานกว่าคำขอที่ anonymise แล้ว
    const longer = settingsFormSchema.safeParse({
      ...validForm,
      retentionYears: "1",
      emailLogRetentionDays: "400",
    });
    expect(longer.error?.issues[0]).toMatchObject({
      path: ["emailLogRetentionDays"],
      message: "settings.errors.emailLogLonger",
    });
    expect(
      settingsFormSchema.safeParse({
        ...validForm,
        retentionYears: "1",
        emailLogRetentionDays: "365",
      }).success,
    ).toBe(true);
  });
});

describe("จุดตัด retention (F-AUD-08)", () => {
  const now = new Date("2026-09-15T03:00:00Z");

  it("คำขอ: ย้อนหลังตามจำนวนวัน", () => {
    expect(requestRetentionCutoff(now, 1825).toISOString()).toBe("2021-09-16T03:00:00.000Z");
  });

  it("audit: ย้อนหลังเป็นปีปฏิทิน รวม 29 ก.พ.", () => {
    expect(auditRetentionCutoff(now, 10).toISOString()).toBe("2016-09-15T03:00:00.000Z");
    expect(auditRetentionCutoff(new Date("2028-02-29T00:00:00Z"), 1).toISOString()).toBe(
      "2027-03-01T00:00:00.000Z",
    );
  });

  it("ประวัติอีเมล: ย้อนหลังตามจำนวนวัน", () => {
    expect(emailLogRetentionCutoff(new Date("2026-09-16T03:00:00Z"), 180).toISOString()).toBe(
      "2026-03-20T03:00:00.000Z",
    );
  });
});

describe("CSV export (F-AUD-04)", () => {
  it("ครอบค่าพิเศษด้วยเครื่องหมายคำพูด", () => {
    expect(csvCell('ชื่อ "ทดสอบ", จำกัด')).toBe('"ชื่อ ""ทดสอบ"", จำกัด"');
    expect(csvCell("บรรทัด1\nบรรทัด2")).toBe('"บรรทัด1\nบรรทัด2"');
    expect(csvCell(null)).toBe("");
  });

  it("กัน formula injection ใน Excel", () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell("+66812345678")).toBe("'+66812345678");
    expect(csvCell("-1")).toBe("'-1");
  });

  it("แปลงวันที่เป็น ISO และ object เป็น JSON · แถวลงท้าย CRLF · มี BOM", () => {
    expect(csvRow([new Date("2026-09-15T00:00:00Z"), { refNo: "KRU-2569-000001" }])).toBe(
      '2026-09-15T00:00:00.000Z,"{""refNo"":""KRU-2569-000001""}"\r\n',
    );
    expect(CSV_BOM).toBe("﻿");
  });
});
