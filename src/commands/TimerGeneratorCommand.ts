import { Modal, Setting } from "obsidian";

/**
 * Modal to generate stamina or periodic-increment timer task lines.
 * Outputs a `- [ ] ...` markdown line that the user can copy.
 */
export class TimerGeneratorModal extends Modal {
  private timerType: "stamina" | "periodic" = "stamina";
  private taskName = "";
  // Stamina fields
  private currentValue = 0;
  private maxValue = 200;
  private intervalSeconds = 432;
  // Periodic fields
  private incrementAmount = 10;
  private scheduleTimes = "06:00,12:00,18:00";
  // Output
  private outputEl: HTMLTextAreaElement | null = null;

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("tasklens-timer-generator");
    contentEl.createEl("h2", { text: "タイマータスク生成" });

    // Timer type selector
    new Setting(contentEl).setName("タイマー種別").addDropdown((dd) => {
      dd.addOption("stamina", "⚡ スタミナ（一定間隔回復）");
      dd.addOption("periodic", "📈 定期増加（時刻指定）");
      dd.setValue(this.timerType);
      dd.onChange((v) => {
        this.timerType = v as "stamina" | "periodic";
        this.renderFields();
        this.updateOutput();
      });
    });

    // Task name
    new Setting(contentEl).setName("タスク名").addText((t) => {
      t.setPlaceholder("例: Arknights スタミナ");
      t.onChange((v) => {
        this.taskName = v;
        this.updateOutput();
      });
    });

    // Dynamic fields container
    const fieldsEl = contentEl.createDiv({ cls: "tasklens-tg-fields" });
    this.renderFieldsInto(fieldsEl);

    // Output
    contentEl.createEl("h3", { text: "生成結果" });
    this.outputEl = contentEl.createEl("textarea", {
      cls: "tasklens-tg-output",
      attr: { readonly: "", rows: "3" },
    });
    this.updateOutput();

    // Copy button
    const btnRow = contentEl.createDiv({ cls: "tasklens-tg-buttons" });
    const copyBtn = btnRow.createEl("button", {
      text: "📋 クリップボードにコピー",
      cls: "mod-cta",
    });
    copyBtn.addEventListener("click", () => {
      if (this.outputEl) {
        navigator.clipboard.writeText(this.outputEl.value);
        copyBtn.textContent = "✅ コピーしました";
        setTimeout(() => {
          copyBtn.textContent = "📋 クリップボードにコピー";
        }, 2000);
      }
    });
  }

  private renderFields(): void {
    const container = this.contentEl.querySelector(".tasklens-tg-fields");
    if (container) {
      container.empty();
      this.renderFieldsInto(container as HTMLElement);
    }
  }

  private renderFieldsInto(el: HTMLElement): void {
    // Common: current value and max value
    new Setting(el).setName("現在値").addText((t) => {
      t.setValue(String(this.currentValue));
      t.inputEl.type = "number";
      t.inputEl.min = "0";
      t.onChange((v) => {
        this.currentValue = parseInt(v, 10) || 0;
        this.updateOutput();
      });
    });

    new Setting(el).setName("最大値").addText((t) => {
      t.setValue(String(this.maxValue));
      t.inputEl.type = "number";
      t.inputEl.min = "1";
      t.onChange((v) => {
        this.maxValue = parseInt(v, 10) || 1;
        this.updateOutput();
      });
    });

    if (this.timerType === "stamina") {
      // Recovery interval
      new Setting(el)
        .setName("回復間隔（秒）")
        .setDesc("1回復あたりの秒数。例: 432秒 = 7分12秒")
        .addText((t) => {
          t.setValue(String(this.intervalSeconds));
          t.inputEl.type = "number";
          t.inputEl.min = "1";
          t.onChange((v) => {
            this.intervalSeconds = parseInt(v, 10) || 60;
            this.updateOutput();
          });
        });

      // Quick presets
      const presetEl = el.createDiv({ cls: "tasklens-tg-presets" });
      presetEl.createEl("span", { text: "プリセット: ", cls: "tasklens-tg-preset-label" });
      const presets = [
        { label: "6分 (360s)", value: 360 },
        { label: "7分12秒 (432s)", value: 432 },
        { label: "10分 (600s)", value: 600 },
      ];
      for (const p of presets) {
        const btn = presetEl.createEl("button", { text: p.label, cls: "tasklens-tg-preset-btn" });
        btn.addEventListener("click", () => {
          this.intervalSeconds = p.value;
          this.renderFields();
          this.updateOutput();
        });
      }
    } else {
      // Increment amount
      new Setting(el)
        .setName("増加量")
        .setDesc("各スケジュール時刻での増加量")
        .addText((t) => {
          t.setValue(String(this.incrementAmount));
          t.inputEl.type = "number";
          t.inputEl.min = "1";
          t.onChange((v) => {
            this.incrementAmount = parseInt(v, 10) || 1;
            this.updateOutput();
          });
        });

      // Schedule times
      new Setting(el)
        .setName("スケジュール時刻")
        .setDesc("カンマ区切りのHH:MM（例: 06:00,12:00,18:00）")
        .addText((t) => {
          t.setValue(this.scheduleTimes);
          t.setPlaceholder("06:00,12:00,18:00");
          t.onChange((v) => {
            this.scheduleTimes = v;
            this.updateOutput();
          });
        });
    }
  }

  private updateOutput(): void {
    if (!this.outputEl) return;
    const name = this.taskName || "タスク名";
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

    let line: string;
    if (this.timerType === "stamina") {
      line = `- [ ] ${name} #stamina ⚡ ${this.currentValue}/${this.maxValue} 🔄 ${this.intervalSeconds}s 📌 ${now}`;
    } else {
      const times = this.scheduleTimes.replace(/\s/g, "") || "06:00";
      line = `- [ ] ${name} #periodic 📈 ${this.currentValue}/${this.maxValue} +${this.incrementAmount} 🕐 ${times} 📌 ${now}`;
    }
    this.outputEl.value = line;
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
