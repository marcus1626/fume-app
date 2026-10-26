// StudioCameraPresets: the camera as named presets (FLOWS §18). The brand's own camera specs ("LYSNE close · 85 mm")
// and Fume's camera presets with a picture of the camera and its body and lens ("Hasselblad X2D 100C · XCD 90 mm"), as
// small cards; picking one sets the lens. The chosen one's note sits under the cards. Own values stay with StudioLens.
//   <StudioCameraPresets label="LYSNE’s cameras" presets={cams} value={pickedId} onPick={(c) => setLens(c.lens)} />
import { StudioPresetPicker } from "./source";
import type { StudioLensValue } from "./types";

export interface StudioCameraPresetData {
  id: string;
  name: string;
  /** The camera and lens in words: "Hasselblad X2D 100C · XCD 90 mm". */
  body: string;
  lens: StudioLensValue;
  /** A picture of the camera (or, for a brand spec, of what it makes). */
  image: string;
  /** One line on when to use it. */
  note?: string;
}

export interface StudioCameraPresetsProps {
  presets: StudioCameraPresetData[];
  /** The preset whose lens is in force, if one is. */
  value?: string;
  onPick: (preset: StudioCameraPresetData) => void;
  /** Names the group ("LYSNE’s cameras", "Fume’s cameras"). */
  label: string;
  disabled?: boolean;
}

export function StudioCameraPresets({ presets, value, onPick, label, disabled }: StudioCameraPresetsProps) {
  const chosen = presets.find((p) => p.id === value);
  return (
    <div className="ui-sl-cameras">
      <StudioPresetPicker
        label={label}
        className="ui-sl-presets--cameras"
        value={value}
        disabled={disabled}
        items={presets.map((p) => ({
          id: p.id,
          name: p.name,
          meta: `${p.lens.focal} mm`,
          line: p.body,
          image: p.image,
        }))}
        onPick={(id) => {
          const p = presets.find((x) => x.id === id);
          if (p) onPick(p);
        }}
      />
      {chosen?.note && <p className="ui-sc-help">{chosen.note}</p>}
    </div>
  );
}
