//
// Copyright © 2024 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

import { AccountRole } from '@hcengineering/core'
import { type Builder } from '@hcengineering/model'
import core from '@hcengineering/model-core'
import view from '@hcengineering/model-view'
import setting from '@hcengineering/setting'
import aiBot from './plugin'

export { aiBotId } from '@hcengineering/ai-bot'
export { aiBotOperation } from './migration'
export default aiBot

export function createModel (builder: Builder): void {
  builder.createDoc(setting.class.WorkspaceSettingCategory, core.space.Model, {
    name: 'agent-missions',
    label: aiBot.string.AgentMissions,
    icon: view.icon.Settings,
    component: aiBot.component.AgentMissions,
    group: 'settings-editor',
    role: AccountRole.Maintainer,
    order: 880
  })
}
