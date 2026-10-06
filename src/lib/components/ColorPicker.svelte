<script lang="ts">
	import { colorPresets, presetColor, rainbow } from '#lib/colors.ts';

	type Props = {
		value?: string;
		label?: string;
	};

	let { value = $bindable('#0f766e'), label = 'Color' }: Props = $props();

	let customInput = $state<HTMLInputElement | null>(null);

	const normalized = $derived(value.toLowerCase());
	const customSelected = $derived(!presetColor(normalized));
	const legendId = $derived(`${label.toLowerCase().replaceAll(' ', '-')}-legend`);

	const circle =
		'size-10 rounded-full shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
	const selected =
		'ring-2 ring-stone-800 ring-offset-2 ring-offset-white dark:ring-stone-100 dark:ring-offset-stone-900';
	const idle = 'ring-1 ring-black/15';

	function choose(next: string) {
		value = next;
	}

	function openCustom() {
		const input = customInput;
		if (!input) return;
		if (typeof input.showPicker === 'function') input.showPicker();
		else input.click();
	}

	function onCustomInput(event: Event) {
		const input = event.currentTarget;
		if (input instanceof HTMLInputElement) value = input.value;
	}
</script>

<div>
	<p class="text-sm font-medium" id={legendId}>{label}</p>
	<div class="mt-2 flex flex-wrap gap-2.5" role="radiogroup" aria-labelledby={legendId}>
		{#each colorPresets as preset (preset.value)}
			<button
				type="button"
				role="radio"
				aria-label={preset.name}
				aria-checked={normalized === preset.value}
				class="{circle} {normalized === preset.value ? selected : idle}"
				style:background-color={preset.value}
				onclick={() => choose(preset.value)}
			></button>
		{/each}

		<button
			type="button"
			role="radio"
			aria-label="Custom color"
			aria-checked={customSelected}
			class="{circle} {customSelected ? selected : idle}"
			style:background={customSelected ? normalized : rainbow}
			onclick={openCustom}
		></button>
		<input
			bind:this={customInput}
			type="color"
			class="sr-only"
			value={normalized}
			aria-hidden="true"
			tabindex="-1"
			oninput={onCustomInput}
		/>
	</div>
</div>
