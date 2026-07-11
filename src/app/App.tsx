import { CustomPage } from "../features/mixer/CustomPage";
import { RecommendPage } from "../features/scenes/RecommendPage";
import { TopTabs } from "../features/scenes/TopTabs";
import { playbackActions } from "../store/playbackStore";
import { usePlayback } from "../store/usePlayback";

export function App() {
  const { tab } = usePlayback();

  return (
    <div className="relative h-full min-h-dvh overflow-hidden bg-black text-white">
      <TopTabs tab={tab} onTabChange={(next) => playbackActions.setTab(next)} />
      {tab === "recommend" ? <RecommendPage /> : <CustomPage />}
    </div>
  );
}
