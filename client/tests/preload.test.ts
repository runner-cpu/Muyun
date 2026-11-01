import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ui: { showLoading: vi.fn(), setLoading: vi.fn(), showLoadingFailure: vi.fn() },
  player: vi.fn(), animals: vi.fn(),
}));
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
vi.mock('../src/ui/instance', () => ({ ui: mocks.ui }));
vi.mock('../src/entities/Player', () => ({ registerPlayerAnims: mocks.player }));
vi.mock('../src/entities/Animal', () => ({ registerAnimalAnims: mocks.animals }));
import { PreloadScene } from '../src/scenes/PreloadScene';

beforeEach(() => vi.clearAllMocks());

function setup() {
  const events = new Map<string, (value: any) => void>();
  const scene = new PreloadScene();
  const start = vi.fn();
  const delay = vi.fn((_ms, callback) => callback());
  Object.assign(scene, {
    load: { image: vi.fn(), spritesheet: vi.fn(), on: (name: string, callback: (value: any) => void) => events.set(name, callback) },
    scene: { start }, time: { delayedCall: delay },
  });
  scene.preload();
  return { scene, events, start, delay };
}

describe('资源加载恢复', () => {
  it('missing assets stop scene creation and later progress does not erase the error', () => {
    const { scene, events, start, delay } = setup();
    events.get('progress')!(0.4);
    events.get('loaderror')!({ key: 'yak' });
    events.get('loaderror')!({ key: 'yak' });
    events.get('loaderror')!({ key: 'sheep' });
    const progressCount = mocks.ui.setLoading.mock.calls.length;
    events.get('progress')!(1);
    scene.create();
    expect(mocks.ui.setLoading).toHaveBeenCalledTimes(progressCount);
    expect(mocks.ui.showLoadingFailure).toHaveBeenLastCalledWith(2);
    expect(mocks.player).not.toHaveBeenCalled();
    expect(mocks.animals).not.toHaveBeenCalled();
    expect(delay).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('successful loading registers animations and reaches the title', () => {
    const { scene, events, start } = setup();
    events.get('progress')!(1);
    scene.create();
    expect(mocks.player).toHaveBeenCalledWith(scene);
    expect(mocks.animals).toHaveBeenCalledWith(scene);
    expect(start).toHaveBeenCalledWith('TitleScene');
    expect(mocks.ui.showLoadingFailure).not.toHaveBeenCalled();
  });
});
