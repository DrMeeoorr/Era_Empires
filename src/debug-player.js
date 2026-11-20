// Variáveis globais de depuração da versão do jogador: só carregado quando os testes automáticos o pedem.
// Gerado a partir da lista de módulos de src/ (tests/structure.test.js confere que não falta nenhum).
import {exposeGlobals} from "./app/debug.js";
import * as ns_ai_decide from "./ai/decide.js";
import * as ns_ai_profiles from "./ai/profiles.js";
import * as ns_app_hooks from "./app/hooks.js";
import * as ns_app_save from "./app/save.js";
import * as ns_app_session from "./app/session.js";
import * as ns_app_setup from "./app/setup.js";
import * as ns_core_config from "./core/config.js";
import * as ns_core_economy from "./core/economy.js";
import * as ns_core_endgame from "./core/endgame.js";
import * as ns_core_era from "./core/era.js";
import * as ns_core_format from "./core/format.js";
import * as ns_core_map from "./core/map.js";
import * as ns_core_match from "./core/match.js";
import * as ns_core_military from "./core/military.js";
import * as ns_core_names from "./core/names.js";
import * as ns_core_references from "./core/references.js";
import * as ns_core_rng from "./core/rng.js";
import * as ns_core_state from "./core/state.js";
import * as ns_core_util from "./core/util.js";
import * as ns_platform_files from "./platform/files.js";
import * as ns_platform_storage from "./platform/storage.js";
import * as ns_ui_allocation from "./ui/allocation.js";
import * as ns_ui_charts from "./ui/charts.js";
import * as ns_ui_dom from "./ui/dom.js";
import * as ns_ui_format from "./ui/format.js";
import * as ns_ui_game from "./ui/game.js";
import * as ns_ui_home from "./ui/home.js";
import * as ns_ui_hud from "./ui/hud.js";
import * as ns_ui_labels from "./ui/labels.js";
import * as ns_ui_map from "./ui/map.js";
import * as ns_ui_mapshape from "./ui/mapshape.js";
import * as ns_ui_modal from "./ui/modal.js";
import * as ns_ui_panels from "./ui/panels.js";
import * as ns_ui_report from "./ui/report.js";
import * as ns_ui_sheets from "./ui/sheets.js";
import * as ns_ui_toast from "./ui/toast.js";
import * as ns_ui_tutorial from "./ui/tutorial.js";

export function install(){return exposeGlobals([ns_ai_decide,ns_ai_profiles,ns_app_hooks,ns_app_save,ns_app_session,ns_app_setup,ns_core_config,ns_core_economy,ns_core_endgame,ns_core_era,ns_core_format,ns_core_map,ns_core_match,ns_core_military,ns_core_names,ns_core_references,ns_core_rng,ns_core_state,ns_core_util,ns_platform_files,ns_platform_storage,ns_ui_allocation,ns_ui_charts,ns_ui_dom,ns_ui_format,ns_ui_game,ns_ui_home,ns_ui_hud,ns_ui_labels,ns_ui_map,ns_ui_mapshape,ns_ui_modal,ns_ui_panels,ns_ui_report,ns_ui_sheets,ns_ui_toast,ns_ui_tutorial])}
