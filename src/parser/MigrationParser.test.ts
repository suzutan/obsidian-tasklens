import { describe, it, expect } from "vitest";
import { migrateLine, migrateFileContent } from "./MigrationParser";

describe("migrateLine", () => {
  it("converts priority p1", () => {
    expect(migrateLine("- [ ] タスク (p1)")).toBe("- [ ] タスク ⏫");
  });

  it("converts priority p2", () => {
    expect(migrateLine("- [ ] タスク (p2)")).toBe("- [ ] タスク 🔼");
  });

  it("converts priority p3", () => {
    expect(migrateLine("- [ ] タスク (p3)")).toBe("- [ ] タスク 🔽");
  });

  it("converts due date", () => {
    expect(migrateLine("- [ ] タスク (due:2026-03-31)")).toBe("- [ ] タスク 📅 2026-03-31");
  });

  it("converts scheduled date", () => {
    expect(migrateLine("- [ ] タスク (scheduled:2026-03-01)")).toBe("- [ ] タスク ⏳ 2026-03-01");
  });

  it("converts start date", () => {
    expect(migrateLine("- [ ] タスク (start:2026-02-01)")).toBe("- [ ] タスク 🛫 2026-02-01");
  });

  it("converts recurrence", () => {
    expect(migrateLine("- [ ] タスク (repeat:monthly/1)")).toBe("- [ ] タスク 🔁 every month on the 1st");
  });

  it("converts done date", () => {
    expect(migrateLine("- [x] タスク (done:2026-03-08)")).toBe("- [x] タスク ✅ 2026-03-08");
  });

  it("converts tags", () => {
    expect(migrateLine("- [ ] タスク (#label)")).toBe("- [ ] タスク #label");
  });

  it("converts complex line with all fields", () => {
    const input = "- [ ] タスク名 (p1, due:2026-03-31, scheduled:2026-03-01, start:2026-02-01, repeat:monthly/1, #label)";
    const result = migrateLine(input);
    expect(result).toContain("⏫");
    expect(result).toContain("📅 2026-03-31");
    expect(result).toContain("⏳ 2026-03-01");
    expect(result).toContain("🛫 2026-02-01");
    expect(result).toContain("🔁 every month on the 1st");
    expect(result).toContain("#label");
  });

  it("leaves non-task lines unchanged", () => {
    expect(migrateLine("## Section")).toBe("## Section");
    expect(migrateLine("普通のテキスト")).toBe("普通のテキスト");
  });

  it("leaves task lines without parenthesized metadata unchanged", () => {
    expect(migrateLine("- [ ] タスク ⏫ 📅 2026-03-31")).toBe("- [ ] タスク ⏫ 📅 2026-03-31");
  });

  it("handles completed tasks", () => {
    expect(migrateLine("- [x] 完了タスク (done:2026-03-08)")).toBe("- [x] 完了タスク ✅ 2026-03-08");
  });
});

describe("migrateFileContent", () => {
  it("migrates multiple lines", () => {
    const input = [
      "## Tasks",
      "- [ ] タスク1 (p1, due:2026-03-31)",
      "- [x] タスク2 (done:2026-03-08)",
      "普通のテキスト",
    ].join("\n");

    const result = migrateFileContent(input);
    const lines = result.split("\n");
    expect(lines[0]).toBe("## Tasks");
    expect(lines[1]).toContain("⏫");
    expect(lines[1]).toContain("📅 2026-03-31");
    expect(lines[2]).toContain("✅ 2026-03-08");
    expect(lines[3]).toBe("普通のテキスト");
  });

  it("handles empty content", () => {
    expect(migrateFileContent("")).toBe("");
  });
});
