import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getTimerType,
  hasResourceTimer,
  computeTimerState,
  computeStaminaState,
  computePeriodicState,
  formatDuration,
  getTimerColor,
  getResourceColor,
} from "./TimerUtils";
import { StaminaConfig, PeriodicIncrementConfig } from "../models/Task";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-10T09:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("getTimerType", () => {
  it("returns 'countdown' for countdown label", () => {
    expect(getTimerType(["countdown"])).toBe("countdown");
  });

  it("returns 'elapsed' for elapsed label", () => {
    expect(getTimerType(["elapsed"])).toBe("elapsed");
  });

  it("returns 'countdown-elapsed' for countdown-elapsed label", () => {
    expect(getTimerType(["countdown-elapsed"])).toBe("countdown-elapsed");
  });

  it("returns null for no timer labels", () => {
    expect(getTimerType(["家事", "仕事"])).toBeNull();
  });

  it("prefers countdown-elapsed over countdown", () => {
    expect(getTimerType(["countdown", "countdown-elapsed"])).toBe("countdown-elapsed");
  });
});

describe("hasResourceTimer", () => {
  it("returns true for stamina label", () => {
    expect(hasResourceTimer(["stamina"])).toBe(true);
  });

  it("returns true for periodic label", () => {
    expect(hasResourceTimer(["periodic"])).toBe(true);
  });

  it("returns false for non-resource labels", () => {
    expect(hasResourceTimer(["countdown", "家事"])).toBe(false);
  });
});

describe("computeTimerState", () => {
  describe("countdown", () => {
    it("returns remaining ms for future due date", () => {
      const state = computeTimerState("countdown", "2026-03-11", null, null, null);
      expect(state).not.toBeNull();
      expect(state!.type).toBe("countdown");
      expect(state!.mode).toBe("countdown");
      expect(state!.isExpired).toBe(false);
      // 15 hours remaining (2026-03-11T00:00:00 - 2026-03-10T09:00:00)
      expect(state!.ms).toBe(15 * 60 * 60 * 1000);
    });

    it("returns expired state for past due date", () => {
      const state = computeTimerState("countdown", "2026-03-09", null, null, null);
      expect(state!.isExpired).toBe(true);
    });

    it("returns null when no due date", () => {
      const state = computeTimerState("countdown", null, null, null, null);
      expect(state).toBeNull();
    });

    it("handles due time", () => {
      const state = computeTimerState("countdown", "2026-03-10", "12:00", null, null);
      expect(state!.ms).toBe(3 * 60 * 60 * 1000); // 3 hours
      expect(state!.isExpired).toBe(false);
    });
  });

  describe("elapsed", () => {
    it("returns elapsed ms from start date", () => {
      const state = computeTimerState("elapsed", null, null, "2026-03-09", null);
      expect(state).not.toBeNull();
      expect(state!.type).toBe("elapsed");
      expect(state!.mode).toBe("elapsed");
      // 33 hours elapsed (2026-03-10T09:00:00 - 2026-03-09T00:00:00)
      expect(state!.ms).toBe(33 * 60 * 60 * 1000);
    });

    it("returns null when no start date", () => {
      const state = computeTimerState("elapsed", null, null, null, null);
      expect(state).toBeNull();
    });
  });

  describe("countdown-elapsed", () => {
    it("counts down before due date", () => {
      const state = computeTimerState("countdown-elapsed", "2026-03-11", null, null, null);
      expect(state!.mode).toBe("countdown");
      expect(state!.isExpired).toBe(false);
    });

    it("shows elapsed after due date", () => {
      const state = computeTimerState("countdown-elapsed", "2026-03-09", null, null, null);
      expect(state!.mode).toBe("elapsed");
      expect(state!.isExpired).toBe(true);
    });
  });

  it("returns null for null timer type", () => {
    const state = computeTimerState(null, "2026-03-11", null, null, null);
    expect(state).toBeNull();
  });
});

describe("computeStaminaState", () => {
  it("computes recovered stamina", () => {
    const config: StaminaConfig = {
      type: "stamina",
      currentValue: 100,
      maxValue: 200,
      recoveryIntervalSeconds: 60,
      lastUpdatedAt: "2026-03-10T08:00:00", // 1 hour ago = 3600 seconds
    };
    const state = computeStaminaState(config);
    // 3600 / 60 = 60 recoveries
    expect(state.currentValue).toBe(160);
    expect(state.isFull).toBe(false);
    expect(state.progress).toBeCloseTo(0.8, 1);
  });

  it("caps at max value", () => {
    const config: StaminaConfig = {
      type: "stamina",
      currentValue: 190,
      maxValue: 200,
      recoveryIntervalSeconds: 60,
      lastUpdatedAt: "2026-03-10T08:00:00", // 1 hour ago
    };
    const state = computeStaminaState(config);
    expect(state.currentValue).toBe(200);
    expect(state.isFull).toBe(true);
    expect(state.nextRecoveryMs).toBe(0);
    expect(state.timeToFullMs).toBe(0);
  });

  it("computes next recovery time", () => {
    const config: StaminaConfig = {
      type: "stamina",
      currentValue: 100,
      maxValue: 200,
      recoveryIntervalSeconds: 120, // 2 minutes
      lastUpdatedAt: "2026-03-10T08:59:00", // 1 minute ago
    };
    const state = computeStaminaState(config);
    // 60 seconds have passed, recovery interval is 120 seconds
    // No recoveries yet (60/120 = 0 full intervals)
    expect(state.currentValue).toBe(100);
    // next recovery in 60 seconds
    expect(state.nextRecoveryMs).toBe(60 * 1000);
  });
});

describe("computePeriodicState", () => {
  it("computes increments from past scheduled events", () => {
    const config: PeriodicIncrementConfig = {
      type: "periodic",
      currentValue: 30,
      maxValue: 100,
      incrementAmount: 10,
      scheduleTimes: ["06:00", "12:00", "18:00"],
      lastUpdatedAt: "2026-03-09T18:00:00", // yesterday 18:00
    };
    const state = computePeriodicState(config);
    // Events since lastUpdated: 2026-03-10 06:00 = +10
    // (12:00 and 18:00 haven't happened yet since now is 09:00)
    expect(state.currentValue).toBe(40);
    expect(state.isAtMax).toBe(false);
  });

  it("caps at max value", () => {
    const config: PeriodicIncrementConfig = {
      type: "periodic",
      currentValue: 95,
      maxValue: 100,
      incrementAmount: 10,
      scheduleTimes: ["06:00"],
      lastUpdatedAt: "2026-03-09T00:00:00", // yesterday
    };
    const state = computePeriodicState(config);
    // Event at 06:00 yesterday and 06:00 today = +20, but capped at 100
    expect(state.currentValue).toBe(100);
    expect(state.isAtMax).toBe(true);
  });

  it("finds next increment time", () => {
    const config: PeriodicIncrementConfig = {
      type: "periodic",
      currentValue: 30,
      maxValue: 100,
      incrementAmount: 10,
      scheduleTimes: ["12:00", "18:00"],
      lastUpdatedAt: "2026-03-10T08:00:00",
    };
    const state = computePeriodicState(config);
    expect(state.nextIncrementAt).not.toBeNull();
    // Next event should be at 12:00 today
    expect(state.nextIncrementAt!.getHours()).toBe(12);
  });
});

describe("formatDuration", () => {
  it("formats seconds", () => {
    expect(formatDuration(45000)).toBe("45秒");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(150000)).toBe("2分 30秒");
  });

  it("formats hours and minutes (no seconds)", () => {
    expect(formatDuration(9000000)).toBe("2時間 30分");
  });

  it("formats days, hours, minutes", () => {
    expect(formatDuration(3 * 86400 * 1000 + 5 * 3600 * 1000 + 12 * 60 * 1000)).toBe("3日 5時間 12分");
  });

  it("formats 0ms", () => {
    expect(formatDuration(0)).toBe("0秒");
  });

  it("does not show seconds when duration >= 1 hour", () => {
    const result = formatDuration(3661000); // 1h 1m 1s
    expect(result).toBe("1時間 1分");
    expect(result).not.toContain("秒");
  });
});

describe("getTimerColor", () => {
  it("returns blue for pure elapsed", () => {
    const color = getTimerColor({ type: "elapsed", ms: 1000, mode: "elapsed", isExpired: false, progress: 0 });
    expect(color).toBe("#246fe0");
  });

  it("returns red for expired", () => {
    const color = getTimerColor({ type: "countdown", ms: 1000, mode: "countdown", isExpired: true, progress: 1 });
    expect(color).toBe("#d1453b");
  });

  it("returns green for low progress", () => {
    const color = getTimerColor({ type: "countdown", ms: 1000, mode: "countdown", isExpired: false, progress: 0.1 });
    expect(color).toBe("#058527");
  });

  it("returns blue for medium-low progress", () => {
    const color = getTimerColor({ type: "countdown", ms: 1000, mode: "countdown", isExpired: false, progress: 0.3 });
    expect(color).toBe("#246fe0");
  });

  it("returns orange for medium-high progress", () => {
    const color = getTimerColor({ type: "countdown", ms: 1000, mode: "countdown", isExpired: false, progress: 0.6 });
    expect(color).toBe("#eb8909");
  });

  it("returns red for high progress", () => {
    const color = getTimerColor({ type: "countdown", ms: 1000, mode: "countdown", isExpired: false, progress: 0.8 });
    expect(color).toBe("#d1453b");
  });
});

describe("getResourceColor", () => {
  it("returns green for >= 75%", () => {
    expect(getResourceColor(0.8)).toBe("#4caf50");
  });

  it("returns blue for >= 50%", () => {
    expect(getResourceColor(0.6)).toBe("#42a5f5");
  });

  it("returns orange for >= 25%", () => {
    expect(getResourceColor(0.3)).toBe("#ffa726");
  });

  it("returns red for < 25%", () => {
    expect(getResourceColor(0.1)).toBe("#ef5350");
  });
});
