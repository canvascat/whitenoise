export type EffectHandle = { stop: () => void };

const BREATH_CLASS = "scene-breath";

/** Gentle CSS scale pulse on the scene background layer. */
export function startBreath(container: HTMLElement): EffectHandle {
  const stage = container.parentElement;
  const bg = stage?.querySelector<HTMLElement>("[data-scene-bg]") ?? stage ?? container;
  bg.classList.add(BREATH_CLASS);

  return {
    stop() {
      bg.classList.remove(BREATH_CLASS);
    },
  };
}
