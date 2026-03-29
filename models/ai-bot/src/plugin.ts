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

import { type IntlString, mergeIds } from '@hcengineering/platform'
import aiBot, { aiBotId } from '@hcengineering/ai-bot'

export default mergeIds(aiBotId, aiBot, {
  string: {
    AgentMissions: 'Agent Missions' as IntlString,
    RunAgentMission: 'Run Agent Mission' as IntlString,
    AgentProfiles: 'Agents' as IntlString,
    ExecutorResources: 'Executors' as IntlString,
    Channels: 'Channels' as IntlString,
    TelegramConnected: 'Telegram: connected' as IntlString,
    TelegramNotConnected: 'Telegram: not connected' as IntlString,
    SlackPlanned: 'Slack: planned' as IntlString,
    DiscordPlanned: 'Discord: planned' as IntlString
  }
})
