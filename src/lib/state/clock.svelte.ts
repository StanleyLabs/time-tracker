let now = $state(Date.now());
let intervalId: ReturnType<typeof setInterval> | undefined;

export function setClockRunning(running: boolean): void {
	if (!running) {
		if (intervalId !== undefined) {
			clearInterval(intervalId);
			intervalId = undefined;
		}
		return;
	}
	now = Date.now();
	if (intervalId !== undefined) return;
	intervalId = setInterval(() => {
		now = Date.now();
	}, 1000);
}

export function snapClock(): void {
	now = Date.now();
}

export const clock = {
	get now(): number {
		return now;
	}
};
