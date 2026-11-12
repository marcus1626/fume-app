// The taste schema: everything Fume records about one picture of a brand, as named fields (Marcus, 10 Nov 2026: "et
// giga schema ... med ALT som er analysert av alle bilder, kategorisert"). A picture read against it is a card; a
// brand's cards together are its taste profile (profile.ts), which says what the brand always does, what a campaign
// chose, and how well Fume knows it (the taste score).
//
// Two kinds of field. `measured` fields are numbers code takes from the pixels (measure.ts, finish.ts): the same
// picture always gives the same number. `read` fields are answered by a vision model from a closed list of options, so
// two readings can be compared and counted; a few are free words where no list would hold them.
//
// `lever` says where the Engine can act on a field: the plan (what the picture is of), the prompt (how it is asked
// for), a reference picture (what words cannot carry), the finish step (applied to the pixels after the picture is
// made), the design layer (words, logo, button), or only the choice between pictures already made.

export const TASTE_SCHEMA_VERSION = 1;

export type Lever = "plan" | "prompt" | "reference" | "finish" | "design" | "select";
/** A read field is asked only where it can be answered: of a picture with people, a product, words, or a face. */
export type When = "always" | "people" | "face" | "several_people" | "product" | "words" | "logo" | "outdoors";

export type Field = {
  key: string;
  group: string;
  label: string;
  how: "measured" | "read";
  type: "number" | "choice" | "choices" | "words";
  /** choice and choices: the closed list. */
  options?: string[];
  /** number: the unit and the range it is read in. */
  unit?: string;
  lo?: number;
  hi?: number;
  /** A circular number (a hue in degrees). */
  circular?: boolean;
  when: When;
  lever: Lever;
  /** What the vision model is asked, where the label alone is not enough. */
  ask?: string;
};

export type Group = { key: string; label: string; about: string; pass: string };
/** What a card keeps for a read field: the option, the options or the words; null where it does not apply or cannot be told. */
export type Answer = string | string[] | null;

/** The groups, in the order a person reads a picture: what it is, what it says, who and what is in it, how it was
 *  shot, lit, coloured and finished, how it is laid out, where it is, and what was set on top. `pass` gathers groups
 *  into one question to the vision model. */
export const GROUPS: Group[] = [
  { key: "kind", label: "What it is", about: "The sort of picture and what it is for.", pass: "idea" },
  { key: "concept", label: "The idea", about: "What the picture is of and what it says.", pass: "idea" },
  { key: "mood", label: "Mood", about: "How it feels, in registers a brand keeps to.", pass: "idea" },
  { key: "people", label: "People", about: "Who is shown, how much of them, what they do and how they look.", pass: "people" },
  { key: "styling", label: "Wardrobe and styling", about: "What people wear and how it is kept.", pass: "people" },
  { key: "product", label: "The product", about: "How the product is shown and how much of the picture it takes.", pass: "subject" },
  { key: "setting", label: "Setting", about: "Where the picture is, its surfaces and props.", pass: "subject" },
  { key: "camera", label: "Camera and lens", about: "Where the camera stands and what the lens does.", pass: "craft" },
  { key: "light", label: "Light", about: "Where the light comes from, how hard it is and what colour.", pass: "craft" },
  { key: "colour", label: "Colour", about: "The palette and the grade.", pass: "look" },
  { key: "finish", label: "Finish and texture", about: "Grain, sharpness, blacks, retouching.", pass: "look" },
  { key: "composition", label: "Composition", about: "Where things sit in the frame.", pass: "look" },
  { key: "design", label: "Graphic design", about: "Words, logo, button and shapes set on the picture.", pass: "design" },
  { key: "format", label: "Format", about: "Shape and size.", pass: "measured" },
];

const fields: Field[] = [];
const labelOf = (key: string) => {
  const s = key.slice(key.indexOf(".") + 1).replaceAll("_", " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};
type Extra = { when?: When; ask?: string; label?: string };
function add(key: string, type: Field["type"], lever: Lever, options: string | undefined, x: Extra = {}) {
  fields.push({
    key,
    group: key.slice(0, key.indexOf(".")),
    label: x.label ?? labelOf(key),
    how: "read",
    type,
    ...(options ? { options: options.split("|").map((o) => o.trim()) } : {}),
    when: x.when ?? "always",
    lever,
    ...(x.ask ? { ask: x.ask } : {}),
  });
}
/** One of the list. */
const one = (key: string, lever: Lever, options: string, x?: Extra) => add(key, "choice", lever, options, x);
/** Any of the list, at most four. */
const any = (key: string, lever: Lever, options: string, x?: Extra) => add(key, "choices", lever, options, x);
/** Free words, at most five short ones, lower case. */
const words = (key: string, lever: Lever, x?: Extra) => add(key, "words", lever, undefined, x);
function num(key: string, lever: Lever, unit: string, lo: number, hi: number, label?: string, circular = false) {
  fields.push({ key, group: key.slice(0, key.indexOf(".")), label: label ?? labelOf(key), how: "measured", type: "number", unit, lo, hi, ...(circular ? { circular } : {}), when: "always", lever });
}

// ─── What it is ──────────────────────────────────────────────────────────────
one("kind.type", "plan", "photograph|photograph_with_graphics|graphics_only|illustration|render_3d|collage|screenshot_of_an_ad|video_frame");
one("kind.use", "plan", "brand_campaign|product_ad|sale_or_offer|social_post|editorial|shop_packshot|lookbook|announcement|testimonial");
one("kind.capture", "prompt", "clean_digital|gritty_digital|film_35mm|film_medium_format|phone|studio_packshot|computer_made|mixed");
one("kind.era_feel", "prompt", "contemporary|nineties|eighties|seventies|y2k|timeless|futuristic");
one("kind.production", "plan", "big_production|mid_production|small_crew|documentary_found");
one("kind.picture_under_graphics", "design", "none|full_photograph|cut_out_on_colour|small_inset", { ask: "If words or shapes are set on it: what kind of picture is underneath?" });

// ─── The idea ────────────────────────────────────────────────────────────────
one("concept.hero", "plan", "person|person_with_product|product|group_of_people|place|object|words_only|texture_or_pattern", { ask: "What the eye lands on first." });
one("concept.product_presence", "plan", "absent|worn_or_used_in_passing|in_use|shown_off|alone_as_hero|a_range", { ask: "How the brand's product is in the picture, if at all." });
one("concept.idea", "plan", "a_feeling_in_a_moment|achievement|everyday_ritual|product_demonstration|product_beauty|a_life_to_want|humour|a_statement_or_quote|an_offer|a_portrait_with_words|craft_and_making|belonging");
one("concept.moment", "plan", "before_the_action|peak_of_the_action|just_after|stillness|posed|none");
one("concept.literalness", "plan", "literal|suggestive|metaphor|abstract");
any("concept.emotion", "plan", "joy|determination|calm|pride|intensity|tenderness|playfulness|awe|confidence|focus|nostalgia|defiance|desire|relief|none");
one("concept.energy", "plan", "still|low|medium|high|explosive");
one("concept.tone", "plan", "serious|warm|playful|heroic|intimate|cool_and_detached|raw|luxurious|clinical|cheerful");
one("concept.staging", "prompt", "candid_documentary|staged_to_look_natural|staged_and_stylised|surreal|studio_plain");
one("concept.talent", "plan", "known_athlete_or_ambassador|cast_model|looks_like_a_real_customer|staff_or_maker|none");
one("concept.story_scope", "plan", "one_moment|a_sequence|a_range_overview|no_story");
one("concept.promise", "plan", "performance|beauty|comfort|health|price|status|belonging|freedom|care|taste|none_stated", { ask: "What the picture promises the viewer." });
one("concept.viewer_position", "plan", "inside_the_action|beside_the_subject|watching_from_outside|addressed_directly|looking_at_an_object");
one("concept.season_or_occasion", "plan", "none|winter|spring|summer|autumn|holiday|sale_event|sports_event|launch");
words("concept.one_line", "plan", { label: "In one line", ask: "One sentence: what the picture says, without naming the brand." });
words("concept.scene_words", "plan", { label: "Scene in words", ask: "Up to five short phrases naming what is in the scene." });

// ─── Mood ────────────────────────────────────────────────────────────────────
words("mood.adjectives", "prompt", { ask: "Up to five adjectives a photographer would use for the mood." });
one("mood.temperature", "prompt", "cold|cool|neutral|warm|hot");
one("mood.pace", "plan", "slow_and_contemplative|steady|fast|frantic");
one("mood.formality", "plan", "casual|relaxed|polished|formal");
one("mood.price_register", "plan", "everyday|mid|premium|luxury");
one("mood.realism", "prompt", "documentary|natural|heightened|fantastical");
one("mood.tension", "plan", "calm|anticipation|struggle|triumph|release");
one("mood.closeness", "plan", "distant|observing|close|intimate");
one("mood.humour", "plan", "none|light|overt");
one("mood.age_feel", "plan", "children|youth|young_adult|adult|mature|ageless");
one("mood.gender_feel", "plan", "feminine|neutral|masculine");
one("mood.polish", "prompt", "rough|natural|polished|glossy");
one("mood.loudness", "plan", "quiet|measured|loud|shouting");
one("mood.optimism", "plan", "dark|sober|hopeful|joyful");
words("mood.references", "reference", { ask: "Up to three cultural references the picture leans on (a genre of photography, a sport, a film look)." });

// ─── People ──────────────────────────────────────────────────────────────────
one("people.count", "plan", "none|one|two|three_to_five|six_or_more|crowd");
one("people.framing", "prompt", "extreme_close_up|close_up|head_and_shoulders|waist_up|three_quarter|full_body|small_in_the_scene|part_of_the_body_only", { when: "people" });
one("people.face", "prompt", "fully_visible|partly_visible|turned_away|cropped_out|covered", { when: "people" });
one("people.gaze", "prompt", "into_the_camera|at_what_they_do|into_the_distance|down|eyes_closed|at_another_person|not_visible", { when: "people" });
one("people.expression", "prompt", "neutral|soft_smile|open_laugh|effort|concentration|stern|shout|surprise|serene|thoughtful|not_visible", { when: "people" });
one("people.mouth", "prompt", "closed|slightly_open|open_with_teeth|not_visible", { when: "face" });
one("people.pose", "prompt", "sport_action|walking_or_moving|standing_posed|standing_relaxed|sitting|lying|leaning|crouching|airborne|working_with_hands|interacting", { when: "people" });
one("people.pose_energy", "prompt", "static|relaxed|dynamic|extreme", { when: "people" });
one("people.body_turn", "prompt", "towards_camera|three_quarter|profile|back_to_camera", { when: "people" });
one("people.hands", "prompt", "holding_the_product|in_the_action|relaxed|on_face_or_body|gesturing|hidden", { when: "people" });
one("people.limbs", "prompt", "contained|open_and_extended|asymmetric_mid_movement|crossed_or_closed", { when: "people", ask: "The shape arms and legs make." });
one("people.weight", "prompt", "balanced|on_one_leg|leaning_forward|off_balance|off_the_ground|seated_or_supported", { when: "people" });
one("people.age", "plan", "child|teen|young_adult|adult|middle_aged|senior|mixed_ages", { when: "people" });
one("people.gender", "plan", "women|men|mixed|not_specific", { when: "people" });
one("people.cast_mix", "plan", "one_person|alike|mixed_cast", { when: "people" });
one("people.build", "plan", "athletic|slim|average|muscular|full|varied", { when: "people" });
one("people.skin_retouch", "finish", "raw_texture|lightly_cleaned|polished|airbrushed", { when: "people" });
one("people.skin_surface", "prompt", "matte|natural|dewy|sweating|wet", { when: "people" });
one("people.makeup", "prompt", "none_visible|natural|styled|bold", { when: "face" });
one("people.hair", "prompt", "loose_natural|tied_for_sport|sleek_styled|covered|wet_or_messy|cropped_or_shaved|not_visible", { when: "people" });
one("people.role", "plan", "athlete|model|at_work|parent_or_family|everyday_customer|expert|celebrity|child_at_play", { when: "people" });
one("people.camera_awareness", "prompt", "posing_for_it|aware_but_natural|unaware", { when: "people" });
one("people.relation", "plan", "couple|friends|family|team|strangers|rivals", { when: "several_people" });
one("people.contact", "prompt", "none|touch|eye_contact|shared_activity|competing", { when: "several_people" });
one("people.spacing", "prompt", "tight_group|loose_group|apart|one_in_front_others_behind", { when: "several_people" });
one("people.share_of_frame", "prompt", "under_a_tenth|a_tenth_to_a_third|a_third_to_two_thirds|over_two_thirds", { when: "people" });
one("people.eye_line", "prompt", "above_the_camera|level_with_it|below_it|not_visible", { when: "face", ask: "Where the eyes sit against the camera's height." });
one("people.head_tilt", "prompt", "upright|tilted|thrown_back|bowed|not_visible", { when: "face" });
one("people.sweat_and_effort", "prompt", "none|a_little|clearly_worked", { when: "people" });
one("people.authenticity", "select", "reads_as_a_real_person|reads_as_a_model|reads_as_generated", { when: "people" });
words("people.distinctive", "reference", { when: "people", ask: "Up to three things about how people are shown that a casting brief would name." });

// ─── Wardrobe and styling ────────────────────────────────────────────────────
one("styling.wardrobe", "prompt", "sportswear|streetwear|casual|smart_casual|formal|workwear|outdoor_gear|swim_or_underwear|uniform|costume", { when: "people" });
one("styling.fit", "prompt", "tight|fitted|relaxed|oversized|layered", { when: "people" });
one("styling.palette", "prompt", "neutrals|all_black|all_white|the_brand_colour|bright_mixed|earth_tones|pastels|denim", { when: "people" });
one("styling.logo_on_clothes", "prompt", "none|subtle|clear|dominant", { when: "people" });
one("styling.accessories", "prompt", "none|minimal|several|statement", { when: "people" });
one("styling.state", "prompt", "pristine|worn_in|dirty_or_sweaty|wet", { when: "people" });
one("styling.pattern", "prompt", "solid|stripes|checks|print|mixed", { when: "people" });
one("styling.layers", "prompt", "one_layer|two|many", { when: "people" });
one("styling.footwear_shown", "prompt", "not_shown|shown|the_point_of_the_picture", { when: "people" });
one("styling.era", "prompt", "current|retro|classic", { when: "people" });
one("styling.coordination", "prompt", "matching_set|coordinated|deliberately_mixed", { when: "people" });

// ─── The product ─────────────────────────────────────────────────────────────
one("product.count", "plan", "one|two|three_to_five|a_range", { when: "product" });
one("product.share_of_frame", "prompt", "under_5_percent|5_to_15|15_to_35|35_to_60|over_60", { when: "product" });
one("product.place", "prompt", "centre|left|right|upper|lower|on_a_third|at_the_edge", { when: "product" });
one("product.angle", "prompt", "front|three_quarter|side|top_down|back|from_below|in_the_hand", { when: "product" });
one("product.state", "plan", "new_and_pristine|in_use|worn|in_its_pack|opened|being_poured_or_served|taken_apart", { when: "product" });
one("product.support", "prompt", "worn_on_the_body|held|on_a_surface|floating|hanging|on_a_plinth|on_the_ground_outdoors", { when: "product" });
one("product.crop", "prompt", "whole|cut_by_the_frame|detail_only", { when: "product" });
one("product.label", "prompt", "readable|partly_readable|not_readable|no_label", { when: "product" });
one("product.touch", "plan", "untouched|touched|used_for_its_purpose|eaten_or_drunk", { when: "product" });
one("product.context", "plan", "where_it_is_used|a_life_around_it|plain_studio|where_it_comes_from|none", { when: "product" });
one("product.scale_cue", "prompt", "a_body|a_hand|a_room_or_furniture|none", { when: "product" });
one("product.light", "prompt", "same_as_the_scene|spot_lit|rim_lit|even_packshot_light", { when: "product" });
one("product.ground", "prompt", "real_contact_shadow|soft_drop_shadow|reflection|cut_out_no_shadow", { when: "product" });
one("product.sharpness", "prompt", "sharpest_thing|as_sharp_as_the_rest|softer_than_the_subject", { when: "product" });
one("product.colour_role", "prompt", "the_only_colour|one_of_the_colours|matches_the_scene|neutral", { when: "product" });
one("product.repeat", "plan", "single|pair|stack_or_row|scattered", { when: "product" });
one("product.importance", "plan", "the_whole_picture|shares_it_with_a_person|a_detail_in_a_scene", { when: "product" });
one("product.surface_shown", "prompt", "matte|satin|glossy|textured|transparent|mixed", { when: "product" });
words("product.kind", "plan", { when: "product", ask: "What the product is, in two or three words." });

// ─── Setting ─────────────────────────────────────────────────────────────────
one("setting.type", "plan", "plain_studio|built_set|home|workplace|shop_or_cafe|gym_or_sports_venue|city_street|residential_street|wild_nature|farm_or_countryside|beach_or_water|mountain_or_snow|transport|empty_void|stage_or_event");
one("setting.inside_outside", "plan", "inside|outside|in_between");
one("setting.specific", "plan", "could_be_anywhere|a_recognisable_region|a_specific_place");
one("setting.register", "plan", "modest_everyday|comfortable|aspirational|luxury|gritty");
one("setting.tidiness", "prompt", "pristine|lived_in|messy|run_down");
one("setting.era", "prompt", "contemporary|retro|historic|timeless");
one("setting.season", "plan", "spring|summer|autumn|winter|not_shown");
one("setting.background_detail", "prompt", "plain|simple|detailed|chaotic");
one("setting.background_role", "plan", "invisible|context|a_second_subject");
any("setting.surfaces", "prompt", "concrete|asphalt|wood|grass|sand|water|snow|fabric|metal|glass|tile|paper_backdrop|stone|carpet|sports_floor|skin");
one("setting.surface_state", "prompt", "dry|wet_and_reflective|dusty|worn|polished");
one("setting.architecture", "prompt", "none|modern|concrete_brutalist|traditional|industrial|domestic|scandinavian_plain|sports_architecture");
one("setting.props", "prompt", "none|few|several|many");
any("setting.nature", "prompt", "plants|trees|sky|water|rock|flowers|animals|none");
one("setting.words_in_scene", "prompt", "none|incidental|prominent", { ask: "Signs, shirts or boards with readable words that belong to the scene." });
one("setting.people_behind", "prompt", "none|a_few_soft|a_crowd");
one("setting.depth", "prompt", "shallow_backdrop|a_room|a_long_view");
one("setting.sky_share", "prompt", "none|a_strip|a_third|half_or_more", { when: "outdoors" });
one("setting.ground_shown", "prompt", "not_shown|a_strip|a_third|half_or_more");
one("setting.weather", "plan", "dry_clear|overcast|rain_or_wet|snow|fog|wind|indoors");
one("setting.time_shown", "plan", "dawn|morning|midday|afternoon|golden_hour|blue_hour|night");
one("setting.human_traces", "prompt", "none|some_wear_and_use|heavy_wear", { ask: "Scuffs, marks and wear that show the place is used." });
one("setting.colour_of_place", "prompt", "neutral|one_strong_colour|many_colours|the_brand_colour");
words("setting.props_named", "prompt", { ask: "Up to five props, named." });
words("setting.place_words", "plan", { ask: "The place in up to four words, as a location scout would say it." });

// ─── Camera and lens ─────────────────────────────────────────────────────────
one("camera.shot_size", "prompt", "very_wide|wide|medium_wide|medium|close|macro");
one("camera.height", "prompt", "on_the_ground|knee|waist|chest|eye|above_the_head|overhead");
one("camera.vertical_angle", "prompt", "steeply_up|up|level|down|straight_down");
one("camera.side_angle", "prompt", "frontal|three_quarter|profile|from_behind");
one("camera.tilt", "prompt", "level|slightly_tilted|strongly_tilted");
one("camera.distance_feel", "prompt", "within_arms_reach|conversation_distance|across_the_room|far_away");
one("camera.focal_feel", "prompt", "ultra_wide_under_24mm|wide_24_to_35mm|normal_40_to_60mm|short_tele_70_to_105mm|tele_135mm_and_up|macro");
one("camera.distortion", "prompt", "none|slight_wide_stretch|strong_wide_or_fisheye|flattened_by_tele");
one("camera.depth_of_field", "prompt", "everything_sharp|deep|medium|shallow|very_shallow");
one("camera.focus_on", "prompt", "eyes_or_face|the_product|hands|a_foreground_object|the_background|the_whole_scene");
one("camera.background_blur", "prompt", "none|soft_but_legible|creamy|bright_discs_of_light");
one("camera.foreground", "prompt", "nothing|a_soft_object_in_front|a_frame_within_the_frame|lines_leading_in");
one("camera.motion", "prompt", "frozen|a_little_blur_in_the_subject|panning_blur|long_exposure|camera_shake");
one("camera.perspective", "prompt", "flat|one_point|two_point|verticals_converging");
one("camera.flash", "prompt", "none|direct_on_camera|off_camera|fill");
any("camera.lens_marks", "finish", "flare|ghosting|colour_fringing|vignette|anamorphic_streak|soft_edges|none");
one("camera.steadiness", "prompt", "locked_off|steady|handheld");
one("camera.subject_to_lens", "prompt", "moving_towards|moving_across|moving_away|still");
one("camera.cropping_in_camera", "prompt", "loose_with_air|close|cuts_into_the_subject");
one("camera.format_feel", "prompt", "full_frame_35mm|medium_format|small_sensor_phone");
one("camera.sharp_plane", "prompt", "thin_slice|the_subject_whole|front_to_back");
one("camera.horizon_line", "prompt", "not_visible|low_in_frame|middle|high_in_frame");

// ─── Light ───────────────────────────────────────────────────────────────────
one("light.source", "prompt", "direct_sun|overcast_sky|open_shade|window|lamps_in_the_scene|soft_studio|hard_studio|flash|screens_or_neon|fire_or_candle|mixed");
one("light.direction", "prompt", "front|front_side|side|back_side_rim|backlight|top|from_below|even_from_everywhere");
one("light.quality", "prompt", "hard|medium|soft|very_soft_and_flat");
one("light.shadow_edge", "prompt", "crisp|medium|feathered|no_shadows");
one("light.shadow_depth", "prompt", "black|dark_with_detail|open|none");
one("light.contrast", "prompt", "flat|medium|high|extreme");
one("light.key_level", "prompt", "low_key|mid_key|high_key");
one("light.fill", "prompt", "none|natural_bounce|sky_fill|strong_fill");
one("light.rim", "prompt", "none|subtle|strong");
one("light.sources_count", "prompt", "one|two|several");
one("light.key_colour", "prompt", "cool_blue|neutral_daylight|warm|golden|coloured");
one("light.colour_contrast", "prompt", "none|warm_light_cool_shadows|cool_light_warm_lamps|coloured_against_coloured");
any("light.air", "prompt", "haze|fog|dust|rain|smoke|steam|clear");
one("light.speculars", "prompt", "none|soft_sheen|sharp_highlights|blown_out");
one("light.catchlights", "prompt", "none|small_point|large_soft|window_shaped|ring|not_visible", { when: "face" });
one("light.sky", "prompt", "clear_blue|scattered_clouds|overcast|dramatic_clouds|sunset_colours|night|not_visible");
one("light.lamps_in_frame", "prompt", "none|one|several");
one("light.believability", "prompt", "as_found|shaped_but_natural|visibly_styled|theatrical");
one("light.on_the_face", "prompt", "evenly_lit|half_lit|rim_only|in_shadow|not_visible", { when: "face" });
one("light.sun_height", "prompt", "low|medium|high|not_visible", { when: "outdoors" });
one("light.shadow_direction", "prompt", "towards_camera|away_from_camera|to_the_side|straight_down|none");
one("light.falloff", "prompt", "even_across_the_frame|falls_off_to_the_edges|pool_of_light_on_the_subject");
one("light.subject_vs_background", "prompt", "subject_brighter|about_the_same|subject_darker_silhouette");
one("light.sun_in_frame", "prompt", "no|at_the_edge_as_flare|in_the_frame", { when: "outdoors" });
one("light.reflections", "prompt", "none|on_wet_ground|on_glass_or_metal|on_skin");

// ─── Colour ──────────────────────────────────────────────────────────────────
one("colour.scheme", "prompt", "one_colour|neighbouring_colours|complementary|neutral_with_one_accent|three_way|many_colours|black_and_white");
one("colour.dominant", "prompt", "black|white|grey|sand_or_beige|brown|red|orange|yellow|green|teal|blue|navy|purple|pink");
one("colour.accent", "prompt", "none|black|white|red|orange|yellow|green|teal|blue|navy|purple|pink|gold");
one("colour.temperature", "prompt", "cold|cool|neutral|warm|hot");
one("colour.saturation_feel", "finish", "drained|muted|natural|rich|pushed");
one("colour.brand_colour", "prompt", "not_present|a_small_accent|a_clear_block|dominant", { ask: "How much of the brand's own colour (the logo's or the product's signature colour) the picture carries." });
one("colour.brand_colour_on", "prompt", "the_product|clothes|the_background|graphics|the_light|a_prop|nowhere");
one("colour.skin_tones", "finish", "true_to_life|golden|cool_and_pale|drained|contrasty", { when: "people" });
one("colour.background_colour", "prompt", "the_place_itself|neutral_backdrop|coloured_backdrop|black|white|gradient");
one("colour.blacks", "finish", "crushed|deep|lifted_and_matte|tinted");
one("colour.whites", "finish", "clean|creamy_warm|cool|blown");
one("colour.grade", "finish", "true_and_neutral|teal_and_orange|warm_film|cool_and_clean|bleached|soft_pastel|contrasty_black_and_white|sepia|cross_processed|vivid_commercial|dark_and_moody");
one("colour.shadow_tint", "finish", "neutral|blue_or_teal|green|purple|warm_brown");
one("colour.highlight_tint", "finish", "neutral|warm_yellow|pink|cool");
one("colour.colour_count", "prompt", "one|two|three|many");
one("colour.contrast_of_colours", "prompt", "tonal_and_close|clear_contrast|clashing");
one("colour.where_colour_sits", "prompt", "in_the_subject|in_the_background|in_the_light|everywhere|in_graphics_only");
one("colour.sky_colour", "prompt", "deep_blue|pale_blue|teal|grey|white|orange_pink|black|not_visible");
one("colour.green_of_nature", "finish", "vivid|natural|olive_muted|dark|none");
words("colour.named", "prompt", { ask: "The picture's three to five main colours, each named as a colourist would (deep teal, chalk white)." });

// ─── Finish and texture ──────────────────────────────────────────────────────
one("finish.grain_feel", "finish", "clean|fine|medium|heavy");
one("finish.sharpness_feel", "finish", "soft|natural|crisp|over_sharpened");
one("finish.local_contrast", "finish", "soft|normal|gritty");
one("finish.glow", "finish", "none|subtle_bloom|strong_bloom");
one("finish.retouching", "finish", "untouched|cleaned|polished_commercial|composited_and_hyperreal");
one("finish.composite", "select", "one_capture|subtle_composite|obvious_composite");
one("finish.texture", "prompt", "smooth_and_clean|natural_materials|gritty_and_tactile");
one("finish.border", "design", "none|white_border|film_frame|rounded_corners|instant_photo");
one("finish.highlight_rolloff", "finish", "hard_clip|normal|soft_film_like");
one("finish.shadow_detail", "finish", "blocked|some_detail|open");
one("finish.dynamic_range_feel", "finish", "compressed_flat|natural|wide_hdr_like");
one("finish.print_feel", "finish", "screen_clean|magazine|newsprint|poster");
any("finish.generated_tells", "select", "plastic_skin|light_with_no_source|everything_equally_sharp|over_smooth_surfaces|impossible_reflections|warped_details|stock_like_emptiness|none", { ask: "Marks of a generated picture, if any." });

// ─── Composition ─────────────────────────────────────────────────────────────
one("composition.subject_place", "prompt", "dead_centre|on_the_centre_line|left_third|right_third|upper_part|lower_part|cut_by_the_edge|scattered");
one("composition.balance", "prompt", "symmetric|asymmetric_but_balanced|deliberately_off_balance");
one("composition.empty_space", "prompt", "none|some|generous|most_of_the_frame");
one("composition.empty_space_where", "prompt", "top|bottom|left|right|all_around|none");
one("composition.planes", "prompt", "one_flat_plane|two_planes|foreground_middle_background");
one("composition.crop", "prompt", "loose_with_surroundings|comfortable|tight|cuts_through_the_subject");
one("composition.crop_on_people", "prompt", "no_cut|top_of_head|at_the_forehead|at_the_chin|limbs_cut|half_a_face", { when: "people" });
one("composition.lines", "prompt", "none|horizontal|vertical|diagonal|curved|radial|leading_to_the_subject");
one("composition.frame_device", "prompt", "none|doorway_or_window|soft_foreground|architecture|arms_or_body|shadow");
one("composition.movement", "prompt", "none|left_to_right|right_to_left|towards_camera|away|upward|downward");
one("composition.room_ahead", "prompt", "ample|tight|against_the_edge|does_not_apply", { ask: "Room in front of where the subject looks or moves." });
one("composition.repetition", "prompt", "none|some|strong");
one("composition.scale", "prompt", "normal|subject_towering|subject_tiny_in_space");
one("composition.geometry", "prompt", "organic|graphic_and_geometric|architectural");
one("composition.density", "prompt", "minimal|moderate|busy|packed");
one("composition.hierarchy", "prompt", "one_clear_hero|hero_and_a_second|several_equal");
one("composition.eye_path", "prompt", "rests_on_one_point|diagonal_sweep|circle|zig_zag|top_to_bottom");
one("composition.room_for_words", "design", "none|a_calm_area_that_belongs_to_the_scene|an_area_left_blank_on_purpose");
one("composition.subject_against_background", "prompt", "clean_outline_against_sky_or_plain|separated_by_blur|separated_by_light|merges_with_it");
one("composition.shape_of_subject", "prompt", "vertical|horizontal|diagonal|triangle|circle|irregular");
one("composition.edges_of_frame", "prompt", "clean|things_cut_by_the_edge|busy_edges");
one("composition.headroom", "prompt", "none|little|comfortable|a_lot", { when: "people" });
one("composition.overlap", "prompt", "nothing_overlaps|some_overlap|layered_overlaps");
one("composition.thirds_or_centre", "prompt", "centred|thirds|golden_or_diagonal|free");

// ─── Graphic design ──────────────────────────────────────────────────────────
one("design.words_amount", "design", "none|one_word|a_short_line|a_few_lines|a_paragraph|dense");
one("design.words_share", "design", "under_5_percent|5_to_15|15_to_30|30_to_50|over_50", { when: "words" });
one("design.headline_place", "design", "top|upper_third|middle|lower_third|bottom|left_column|right_column|across_the_subject", { when: "words" });
one("design.headline_align", "design", "left|centred|right|justified", { when: "words" });
one("design.headline_case", "design", "all_capitals|sentence_case|title_case|all_lower_case|mixed", { when: "words" });
one("design.headline_face", "design", "grotesque_sans|geometric_sans|humanist_sans|condensed_sans|old_style_serif|modern_high_contrast_serif|slab_serif|script|custom_display|monospace", { when: "words" });
one("design.headline_weight", "design", "light|regular|medium|bold|black", { when: "words" });
one("design.headline_width", "design", "condensed|normal|extended", { when: "words" });
one("design.headline_size", "design", "small_and_discreet|medium|large|dominant", { when: "words" });
one("design.headline_tracking", "design", "tight|normal|wide", { when: "words" });
one("design.headline_leading", "design", "tight|normal|airy", { when: "words" });
one("design.headline_colour", "design", "white|black|the_brand_colour|another_colour|cut_out_of_the_picture", { when: "words" });
one("design.headline_ground", "design", "straight_on_the_picture|on_a_solid_block|on_a_flat_tint|on_a_gradient|outlined|with_a_shadow|behind_the_subject", { when: "words" });
one("design.typefaces", "design", "one|two|three_or_more", { when: "words" });
one("design.second_text", "design", "none|a_subline|body_copy|caption_or_credit|legal_line", { when: "words" });
one("design.type_levels", "design", "one_size|two_levels|a_strong_hierarchy", { when: "words" });
one("design.logo", "design", "none|symbol_only|wordmark|symbol_and_wordmark|on_the_product_only");
one("design.logo_place", "design", "top_left|top_centre|top_right|bottom_left|bottom_centre|bottom_right|centre", { when: "logo" });
one("design.logo_size", "design", "tiny|small|medium|large", { when: "logo" });
one("design.logo_colour", "design", "white|black|the_brand_colour|full_colour", { when: "logo" });
one("design.button", "design", "none|text_link|solid_button|outline_button|platform_button", { ask: "The call to action as drawn in the picture; a button of the ad platform's own counts as platform_button." });
one("design.button_place", "design", "bottom_left|bottom_centre|bottom_right|after_the_copy|none");
one("design.button_shape", "design", "pill|rounded|square|underlined_text|none");
one("design.price_or_offer", "design", "none|a_price|a_discount|a_code|a_deadline");
one("design.badge", "design", "none|award|new|sale|certification");
any("design.shapes", "design", "none|rules_and_lines|blocks|frames|icons|arrows|patterns|cut_outs|stickers|hand_drawn");
one("design.layout", "design", "full_picture_words_on_top|picture_and_a_panel|picture_in_a_frame|words_only|product_on_colour|a_grid_of_pictures|platform_card");
one("design.margins", "design", "tight|normal|generous", { when: "words" });
one("design.darkening", "design", "none|subtle|strong", { when: "words", ask: "Whether the picture is darkened under the words." });
one("design.words_and_picture", "design", "words_in_a_calm_area|words_across_the_subject|words_woven_with_the_subject|words_on_their_own_panel", { when: "words" });
one("design.corners", "design", "sharp|slightly_rounded|rounded|no_boxes");
one("design.colour_blocks", "design", "none|one|several");
one("design.copy_form", "design", "statement|question|quotation|instruction|offer|story|wordplay", { when: "words" });
one("design.copy_voice", "design", "we|you|i|impersonal", { when: "words" });
one("design.copy_length", "design", "one_to_three_words|four_to_eight|nine_to_twenty|over_twenty", { when: "words" });
one("design.punctuation", "design", "none|full_stops|exclamation|question_mark|quotation_marks", { when: "words" });
one("design.attribution", "design", "none|a_name_under_a_quote|a_credit_line", { when: "words" });
one("design.small_print", "design", "none|present", { when: "words" });
one("design.handles_or_tags", "design", "none|present", { when: "words" });
one("design.emphasis", "design", "none|one_word_bigger|colour_on_a_word|underline_or_box", { when: "words" });
one("design.line_breaks", "design", "one_line|broken_for_sense|stacked_one_word_a_line|ragged", { when: "words" });
one("design.words_colour_count", "design", "one|two|three_or_more", { when: "words" });
one("design.language", "design", "english|norwegian|german|french|other|mixed", { when: "words" });
words("design.headline_text", "design", { when: "words", ask: "The headline exactly as written, at most 20 words." });
words("design.typeface_guess", "design", { when: "words", ask: "The headline typeface or its nearest known relatives, at most three names." });

// ─── Measured by code ────────────────────────────────────────────────────────
// measure.ts (the picture made small, 256 px): light, colour, detail and composition.
num("light.key", "finish", "L*", 0, 100, "Brightness");
num("light.contrast_range", "finish", "L* range", 0, 100, "Contrast");
num("light.shadows", "finish", "L*", 0, 60, "Shadows");
num("light.midtone", "finish", "L*", 0, 100, "Mid-tones");
num("light.highlights", "finish", "L*", 40, 100, "Highlights");
num("light.mid_share", "finish", "share", 0, 1, "Tonal range");
num("light.clip_shadows", "finish", "% of picture", 0, 30, "Crushed blacks");
num("light.clip_highlights", "finish", "% of picture", 0, 30, "Blown highlights");
num("light.vignette", "finish", "corners / centre", 0.4, 1.4, "Vignette");
num("light.from_side", "prompt", "right minus left", -1, 1, "Light across");
num("light.from_above", "prompt", "top minus bottom", -1, 1, "Light down");
num("colour.warmth", "finish", "b*", -30, 50, "Warmth");
num("colour.tint", "finish", "a*", -20, 30, "Tint");
num("colour.white_balance", "finish", "b* of neutrals", -20, 30, "White balance");
num("colour.white_tint", "finish", "a* of neutrals", -15, 15, "Neutral tint");
num("colour.saturation", "finish", "C*", 0, 60, "Saturation");
num("colour.saturation_peak", "finish", "C* p90", 0, 100, "Strongest colours");
num("colour.colourfulness", "finish", "M", 0, 120, "Colourfulness");
num("colour.hue_main", "prompt", "hue°", 0, 360, "Main colour family", true);
num("colour.hue_spread", "prompt", "spread", 0, 1, "Colour families");
num("colour.warm_share", "prompt", "share warm", 0, 1, "Warm against cool");
num("colour.coloured_share", "prompt", "share", 0, 1, "How much is coloured");
num("finish.sharpness_overall", "finish", "log Laplacian", 0, 4, "Sharpness overall");
num("composition.busyness", "prompt", "edge share", 0, 0.5, "Busyness");
num("finish.grain_overall", "finish", "noise", 0, 10, "Grain overall");
num("composition.space", "prompt", "share of frame", 0, 1, "Empty space");
num("composition.across", "prompt", "0 left, 1 right", 0, 1, "Subject across");
num("composition.down", "prompt", "0 top, 1 bottom", 0, 1, "Subject height");
num("composition.thirds", "prompt", "distance", 0, 0.5, "Rule of thirds");
num("composition.symmetry", "prompt", "1 = mirror", 0, 1, "Symmetry");
num("composition.subject_size", "prompt", "share of frame", 0, 1, "Subject size");
num("composition.headroom_measured", "prompt", "share above", 0, 1, "Headroom (measured)");
num("format.aspect", "plan", "width / height", 0.4, 2, "Shape");
// finish.ts (the picture at its own size): what making it small erases.
num("format.megapixels", "select", "MP", 0, 60, "Size");
num("finish.grain_shadows", "finish", "noise L*", 0, 8, "Grain in the shadows");
num("finish.grain_mids", "finish", "noise L*", 0, 8, "Grain in the mid-tones");
num("finish.grain_highlights", "finish", "noise L*", 0, 8, "Grain in the highlights");
num("finish.grain_chroma", "finish", "noise C*", 0, 8, "Colour noise");
num("finish.black_point", "finish", "L* p1", 0, 40, "Black point");
num("finish.white_point", "finish", "L* p99", 60, 100, "White point");
num("finish.midtone_slope", "finish", "L* p75 minus p25", 0, 70, "Mid-tone contrast");
num("finish.shadow_a", "finish", "a* of shadows", -15, 15, "Shadow tint, green to red");
num("finish.shadow_b", "finish", "b* of shadows", -20, 20, "Shadow tint, blue to yellow");
num("finish.highlight_a", "finish", "a* of highlights", -15, 15, "Highlight tint, green to red");
num("finish.highlight_b", "finish", "b* of highlights", -20, 30, "Highlight tint, blue to yellow");
num("finish.split_tone", "finish", "b* highlights minus shadows", -30, 40, "Split tone");
num("finish.sat_shadows", "finish", "C*", 0, 60, "Saturation in the shadows");
num("finish.sat_mids", "finish", "C*", 0, 60, "Saturation in the mid-tones");
num("finish.sat_highlights", "finish", "C*", 0, 60, "Saturation in the highlights");
num("finish.local_contrast_measured", "finish", "L* sd, fine", 0, 12, "Local contrast");
num("finish.sharpness_peak", "finish", "log Laplacian p95", 0, 6, "Sharpest detail");
num("finish.sharp_share", "prompt", "share of frame", 0, 1, "How much is sharp");
num("finish.sharp_centre", "prompt", "centre minus border", -1, 1, "Sharpness in the centre against the border");
num("finish.halation", "finish", "L* around highlights", 0, 30, "Glow around highlights");
num("finish.blockiness", "select", "8 px grid", 0, 5, "Compression");
num("colour.black_share", "prompt", "share", 0, 1, "How much is black");
num("colour.white_share", "prompt", "share", 0, 1, "How much is white");
num("colour.neutral_share", "prompt", "share", 0, 1, "How much is neutral");
num("colour.skin_share", "prompt", "share", 0, 1, "Skin tones in the frame");
num("colour.dominant_share", "prompt", "share", 0, 1, "Share of the main colour");
num("colour.palette_contrast", "prompt", "ΔE", 0, 150, "Contrast between the main colours");
num("colour.hue_entropy", "prompt", "0 one hue, 1 all", 0, 1, "Spread of hues");
num("colour.blue_share", "prompt", "share", 0, 1, "Blue and teal in the frame");
num("colour.green_share", "prompt", "share", 0, 1, "Green in the frame");
num("colour.red_share", "prompt", "share", 0, 1, "Red and orange in the frame");
num("composition.calm_top", "design", "share calm", 0, 1, "Calm area at the top");
num("composition.calm_bottom", "design", "share calm", 0, 1, "Calm area at the bottom");
num("composition.calm_left", "design", "share calm", 0, 1, "Calm area on the left");
num("composition.calm_right", "design", "share calm", 0, 1, "Calm area on the right");
num("composition.weight_top", "prompt", "share of detail", 0, 1, "Detail in the upper half");
num("composition.weight_left", "prompt", "share of detail", 0, 1, "Detail in the left half");
num("composition.lines_horizontal", "prompt", "share of edges", 0, 1, "Horizontal lines");
num("composition.lines_vertical", "prompt", "share of edges", 0, 1, "Vertical lines");
num("composition.lines_diagonal", "prompt", "share of edges", 0, 1, "Diagonal lines");
num("composition.centre_detail", "prompt", "centre / border", 0, 5, "Detail in the centre against the border");
num("composition.top_brightness", "prompt", "L* top third", 0, 100, "Brightness of the top third");
num("composition.bottom_brightness", "prompt", "L* bottom third", 0, 100, "Brightness of the bottom third");

export const FIELDS: readonly Field[] = fields;
export const FIELD: ReadonlyMap<string, Field> = new Map(fields.map((f) => [f.key, f]));
if (FIELD.size !== fields.length) throw new Error("The taste schema names a field twice.");

export const readFields = (pass?: string) =>
  FIELDS.filter((f) => f.how === "read" && (!pass || GROUPS.find((g) => g.key === f.group)?.pass === pass));
export const measuredFields = () => FIELDS.filter((f) => f.how === "measured");
/** The questions to the vision model, in the order they are asked; `idea` comes first and says what else applies. */
export const PASSES = ["idea", "people", "subject", "craft", "look", "design"] as const;
export type Pass = (typeof PASSES)[number];

/** What a picture shows, from the first pass: decides which fields can be answered of it. */
export type Shows = { people: boolean; face: boolean; severalPeople: boolean; product: boolean; words: boolean; logo: boolean; outdoors: boolean };
export function applies(f: Field, s: Shows): boolean {
  switch (f.when) {
    case "always": return true;
    case "people": return s.people;
    case "face": return s.people && s.face;
    case "several_people": return s.severalPeople;
    case "product": return s.product;
    case "words": return s.words;
    case "logo": return s.logo;
    case "outdoors": return s.outdoors;
  }
}
