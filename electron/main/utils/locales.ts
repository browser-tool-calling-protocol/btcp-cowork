import EnUs from '../../../src/renderer/src/i18n/locales/en-us.json'
import ZhCn from '../../../src/renderer/src/i18n/locales/zh-cn.json'
import ZhTw from '../../../src/renderer/src/i18n/locales/zh-tw.json'
// Machine translation
import deDE from '../../../src/renderer/src/i18n/translate/de-de.json'
import elGR from '../../../src/renderer/src/i18n/translate/el-gr.json'
import esES from '../../../src/renderer/src/i18n/translate/es-es.json'
import frFR from '../../../src/renderer/src/i18n/translate/fr-fr.json'
import JaJP from '../../../src/renderer/src/i18n/translate/ja-jp.json'
import ptPT from '../../../src/renderer/src/i18n/translate/pt-pt.json'
import roRO from '../../../src/renderer/src/i18n/translate/ro-ro.json'
import RuRu from '../../../src/renderer/src/i18n/translate/ru-ru.json'

const locales = Object.fromEntries(
  [
    ['en-US', EnUs],
    ['zh-CN', ZhCn],
    ['zh-TW', ZhTw],
    ['ja-JP', JaJP],
    ['ru-RU', RuRu],
    ['de-DE', deDE],
    ['el-GR', elGR],
    ['es-ES', esES],
    ['fr-FR', frFR],
    ['pt-PT', ptPT],
    ['ro-RO', roRO]
  ].map(([locale, translation]) => [locale, { translation }])
)

export { locales }
