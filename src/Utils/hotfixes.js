const backendName = process.env.BACKEND_NAME;
const xmppPort = process.env.XMPP_PORT;

import dotenv from "dotenv"
dotenv.config();

export const defaultengine = `
[OnlineSubsystemMcp.Xmpp]
bUseSSL=true
ServerAddr="ws://127.0.0.1:${xmppPort}"
ServerPort=${xmppPort}

[OnlineSubsystemMcp.Xmpp Prod]
bUseSSL=true
ServerAddr="ws://127.0.0.1:${xmppPort}"
ServerPort=${xmppPort}

[ConsoleVariables]
Weapon.TryToFireRestrictedByTypeCooldowns=0
n.VerifyPeer=0
FortMatchmakingV2.ContentBeaconFailureCancelsMatchmaking=0
Fort.ShutdownWhenContentBeaconFails=0
FortMatchmakingV2.EnableContentBeacon=0

[OnlineSubsystemMcp.OnlineWaitingRoomMcp]
bEnabled=false
ServiceName="waitingroom"
GracePeriod=300
RetryConfigUrl="https://s3-us-west-1.amazonaws.com/launcher-resources/waitingroom"

[/Script/Qos.QosRegionManager]
NumTestsPerRegion=1
PingTimeout=3.0
!RegionDefinitions=ClearArray
+RegionDefinitions=(DisplayName="${backendName} - NAE", RegionId="NAE", bEnabled=true, bVisible=true, bAutoAssignable=true)
+RegionDefinitions=(DisplayName="${backendName} - EU", RegionId="EU", bEnabled=true, bVisible=true, bAutoAssignable=false)
!DatacenterDefinitions=ClearArray
+DatacenterDefinitions=(Id="DE", RegionId="EU", bEnabled=true, Servers[0]=(Address="ping-eu.ds.on.epicgames.com", Port=22222))
+DatacenterDefinitions=(Id="VA", RegionId="NAE", bEnabled=true, Servers[0]=(Address="ping-nae.ds.on.epicgames.com", Port=22222))
`;

export const defaultgame = `
[/Script/EngineSettings.GeneralProjectSettings]
ProjectID=(A=-2011270876,B=1182903154,C=-965786730,D=-1399474123)
ProjectName=Fortnite
ProjectDisplayedTitle=NSLOCTEXT("", "FortniteMainWindowTitle", "Fortnite")
ProjectVersion=1.0.0
CompanyName=Epic Games, Inc.
CompanyDistinguishedName="CN=Epic Games, O=Epic Games, L=Cary, S=North Carolina, C=US"
CopyrightNotice=Copyright Epic Games, Inc. All Rights Reserved.
bUseBorderlessWindow=True

[/Script/FortniteGame.FortGlobals]
bAllowLogout=false

[/Script/FortniteGame.FortChatManager]
bShouldRequestGeneralChatRooms=false
bShouldJoinGlobalChat=false
bShouldJoinFounderChat=false
bIsAthenaGlobalChatEnabled=false

[/Script/FortniteGame.FortTextHotfixConfig]
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="LoadingScreen", Key="Connecting", NativeString="CONNECTING", LocalizedStrings=(("en","CONNECTING TO ${backendName}")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="FortLoginStatus", Key="LoggingIn", NativeString="Logging In...", LocalizedStrings=(("ar","Logging In to ${backendName}..."),("en","Logging In to ${backendName}..."),("de","Logging In to ${backendName}..."),("es","Logging In to ${backendName}..."),("es-419","Logging In to ${backendName}..."),("fr","Logging In to ${backendName}..."),("it","Logging In to ${backendName}..."),("ja","Logging In to ${backendName}..."),("ko","Logging In to ${backendName}..."),("pl","Logging In to ${backendName}..."),("pt-BR","Logging In to ${backendName}..."),("ru","Logging In to ${backendName}..."),("tr","Logging In to ${backendName}..."),("zh-CN","Logging In to ${backendName}..."),("zh-Hant","Logging In to ${backendName}...")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="OnlineAccount", Key="DoQosPingTests", NativeString="Checking connection to datacenters...", LocalizedStrings=(("ar","Checking connection to ${backendName}..."),("en","Checking connection to ${backendName}..."),("de","Checking connection to ${backendName}..."),("es","Checking connection to ${backendName}..."),("es-419","Checking connection to ${backendName}..."),("fr","Checking connection to ${backendName}..."),("it","Checking connection to ${backendName}..."),("ja","Checking connection to ${backendName}..."),("ko","Checking connection to ${backendName}..."),("pl","Checking connection to ${backendName}..."),("pt-BR","Checking connection to ${backendName}..."),("ru","Checking connection to ${backendName}..."),("tr","Checking connection to ${backendName}..."),("zh-CN","Checking connection to ${backendName}..."),("zh-Hant","Checking connection to ${backendName}...")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="", Key="37020CCD402F073607D9D4A9561EF035", NativeString="PLAY", LocalizedStrings=(("ar","${backendName}"),("en","${backendName}"),("de","${backendName}"),("es","${backendName}"),("es-419","${backendName}"),("fr","${backendName}"),("it","${backendName}"),("ja","${backendName}"),("ko","${backendName}"),("pl","${backendName}"),("pt-BR","PLAY"),("ru","${backendName}"),("tr","${backendName}"),("zh-CN","${backendName}"),("zh-Hant","${backendName}")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="", Key="C8C6606D4ED4B816D4A358A42DFBDD59", NativeString="PLAY", LocalizedStrings=(("ar","${backendName}"),("en","${backendName}"),("de","${backendName}"),("es","${backendName}"),("es-419","${backendName}"),("fr","${backendName}"),("it","${backendName}"),("ja","${backendName}"),("ko","${backendName}"),("pl","${backendName}"),("pt-BR","PLAY"),("ru","${backendName}"),("tr","${backendName}"),("zh-CN","${backendName}"),("zh-Hant","${backendName}")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="", Key="03875FFD49212D2F37B01788C09086B5", NativeString="Quit", LocalizedStrings=(("ar","Quit ${backendName}"),("en","Quit ${backendName}"),("de","Quit ${backendName}"),("es","Quit ${backendName}"),("es-419","Quit ${backendName}"),("fr","Quit ${backendName}"),("it","Quit ${backendName}"),("ja","Quit ${backendName}"),("ko","Quit ${backendName}"),("pl","Quit ${backendName}"),("pt-BR","Quit ${backendName}"),("ru","Quit ${backendName}"),("tr","Quit ${backendName}"),("zh-CN","Quit ${backendName}"),("zh-Hant","Quit ${backendName}")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="", Key="1D20854C403FDD474AE7C8B929815DA2", NativeString="Quit", LocalizedStrings=(("ar","Quit ${backendName}"),("en","Quit ${backendName}"),("de","Quit ${backendName}"),("es","Quit ${backendName}"),("es-419","Quit ${backendName}"),("fr","Quit ${backendName}"),("it","Quit ${backendName}"),("ja","Quit ${backendName}"),("ko","Quit ${backendName}"),("pl","Quit ${backendName}"),("pt-BR","Quit ${backendName}"),("ru","Quit ${backendName}"),("tr","Quit ${backendName}"),("zh-CN","Quit ${backendName}"),("zh-Hant","Quit ${backendName}")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="", Key="1FB7052F40BE8B647B5CA5A362BE8F21", NativeString="Quit", LocalizedStrings=(("ar","Quit ${backendName}"),("en","Quit ${backendName}"),("de","Quit ${backendName}"),("es","Quit ${backendName}"),("es-419","Quit ${backendName}"),("fr","Quit ${backendName}"),("it","Quit ${backendName}"),("ja","Quit ${backendName}"),("ko","Quit ${backendName}"),("pl","Quit ${backendName}"),("pt-BR","Quit ${backendName}"),("ru","Quit ${backendName}"),("tr","Quit ${backendName}"),("zh-CN","Quit ${backendName}"),("zh-Hant","Quit ${backendName}")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="", Key="2E42C9FB4F551A859C05BF99F7E36FB1", NativeString="Quit", LocalizedStrings=(("ar","Quit ${backendName}"),("en","Quit ${backendName}"),("de","Quit ${backendName}"),("es","Quit ${backendName}"),("es-419","Quit ${backendName}"),("fr","Quit ${backendName}"),("it","Quit ${backendName}"),("ja","Quit ${backendName}"),("ko","Quit ${backendName}"),("pl","Quit ${backendName}"),("pt-BR","Quit ${backendName}"),("ru","Quit ${backendName}"),("tr","Quit ${backendName}"),("zh-CN","Quit ${backendName}"),("zh-Hant","Quit ${backendName}")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="", Key="370415344EEEA09D8C01A48F4B8148D7", NativeString="Quit", LocalizedStrings=(("ar","Quit ${backendName}"),("en","Quit ${backendName}"),("de","Quit ${backendName}"),("es","Quit ${backendName}"),("es-419","Quit ${backendName}"),("fr","Quit ${backendName}"),("it","Quit ${backendName}"),("ja","Quit ${backendName}"),("ko","Quit ${backendName}"),("pl","Quit ${backendName}"),("pt-BR","Quit ${backendName}"),("ru","Quit ${backendName}"),("tr","Quit ${backendName}"),("zh-CN","Quit ${backendName}"),("zh-Hant","Quit ${backendName}")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="", Key="538BD1FD46BCEFA4813E2FAFAA07E1A2", NativeString="Quit", LocalizedStrings=(("ar","Quit ${backendName}"),("en","Quit ${backendName}"),("de","Quit ${backendName}"),("es","Quit ${backendName}"),("es-419","Quit ${backendName}"),("fr","Quit ${backendName}"),("it","Quit ${backendName}"),("ja","Quit ${backendName}"),("ko","Quit ${backendName}"),("pl","Quit ${backendName}"),("pt-BR","Quit ${backendName}"),("ru","Quit ${backendName}"),("tr","Quit ${backendName}"),("zh-CN","Quit ${backendName}"),("zh-Hant","Quit ${backendName}")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="FortTeamMemberPedestalNameplate", Key="NotReady", NativeString="Not Ready", LocalizedStrings=(("ar","Not Ready"),("en","Not Ready"),("de","Not Ready"),("es","Not Ready"),("es-419","Not Ready"),("fr","Not Ready"),("it","Not Ready"),("ja","Not Ready"),("ko","Not Ready"),("pl","Not Ready"),("pt-BR","Not Ready"),("ru","Not Ready"),("tr","Not Ready"),("zh-CN","Not Ready"),("zh-Hant","Not Ready")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="", Key="F1B39B41400513DFDBBC39BE41A2AA7A", NativeString="Save The\r\nWorld", LocalizedStrings=(("ar","UNAVAILABLE"),("en","UNAVAILABLE"),("de","UNAVAILABLE"),("es","UNAVAILABLE"),("es-419","UNAVAILABLE"),("fr","UNAVAILABLE"),("it","UNAVAILABLE"),("ja","UNAVAILABLE"),("ko","UNAVAILABLE"),("pl","UNAVAILABLE"),("pt-BR","UNAVAILABLE"),("ru","UNAVAILABLE"),("tr","UNAVAILABLE"),("zh-CN","UNAVAILABLE"),("zh-Hant","UNAVAILABLE")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="", Key="85CC70F746437FF312DF528927FD1F52", NativeString="Creative", LocalizedStrings=(("ar","UNAVAILABLE"),("en","UNAVAILABLE"),("de","UNAVAILABLE"),("es","UNAVAILABLE"),("es-419","UNAVAILABLE"),("fr","UNAVAILABLE"),("it","UNAVAILABLE"),("ja","UNAVAILABLE"),("ko","UNAVAILABLE"),("pl","UNAVAILABLE"),("pt-BR","UNAVAILABLE"),("ru","UNAVAILABLE"),("tr","UNAVAILABLE"),("zh-CN","UNAVAILABLE"),("zh-Hant","UNAVAILABLE")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="FortTeamMemberPedestalNameplate", Key="NotReady", NativeString="Not Ready", LocalizedStrings=(("ar","${backendName} - Not Ready"),("en","${backendName} - Not Ready"),("de","${backendName} - Not Ready"),("es","${backendName} - Not Ready"),("es-419","${backendName} - Not Ready"),("fr","${backendName} - Not Ready"),("it","${backendName} - Not Ready"),("ja","${backendName} - Not Ready"),("ko","${backendName} - Not Ready"),("pl","${backendName} - Not Ready"),("pt-BR","${backendName} - Not Ready"),("ru","${backendName} - Not Ready"),("tr","${backendName} - Not Ready"),("zh-CN","${backendName} - Not Ready"),("zh-Hant","${backendName} - Not Ready")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="FortTeamMemberPedestalNameplate", Key="Ready", NativeString="Ready", LocalizedStrings=(("ar","${backendName} - Ready"),("en","${backendName} - Ready"),("de","${backendName} - Ready"),("es","${backendName} - Ready"),("es-419","${backendName} - Ready"),("fr","${backendName} - Ready"),("it","${backendName} - Ready"),("ja","${backendName} - Ready"),("ko","${backendName} - Ready"),("pl","${backendName} - Ready"),("pt-BR","${backendName} - Ready"),("ru","${backendName} - Ready"),("tr","${backendName} - Ready"),("zh-CN","${backendName} - Ready"),("zh-Hant","${backendName} - Ready")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="", Key="9E7AAA2A43F588035DF8AEACFF75E4D5", NativeString="Battle\r\nRoyale", LocalizedStrings=(("ar"," ${backendName} - Battle\r\nRoyale"),("en"," ${backendName} - Battle\r\nRoyale"),("de"," ${backendName} - Battle\r\nRoyale"),("es"," ${backendName} - Battle\r\nRoyale"),("es-419"," ${backendName} - Battle\r\nRoyale"),("fr"," ${backendName} - Battle\r\nRoyale"),("it"," ${backendName} - Battle\r\nRoyale"),("ja"," ${backendName} - Battle\r\nRoyale"),("ko"," ${backendName} - Battle\r\nRoyale"),("pl"," ${backendName} - Battle\r\nRoyale"),("pt-BR"," ${backendName} - Battle\r\nRoyale"),("ru"," ${backendName} - Battle\r\nRoyale"),("tr"," ${backendName} - Battle\r\nRoyale"),("zh-CN"," ${backendName} - Battle\r\nRoyale"),("zh-Hant"," ${backendName} - Battle\r\nRoyale")))

+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="OnlineAccount", Key="TokenExpired", NativeString="Login Expired or Logged In Elsewhere", LocalizedStrings=(("ar","Our backend has been restarted, please re-launch Fortnite."),("en","Our backend has been restarted, please re-launch Fortnite."),("de","Our backend has been restarted, please re-launch Fortnite."),("es","Our backend has been restarted, please re-launch Fortnite."),("es-419","Our backend has been restarted, please re-launch Fortnite."),("fr","Our backend has been restarted, please re-launch Fortnite."),("it","Our backend has been restarted, please re-launch Fortnite."),("ja","Our backend has been restarted, please re-launch Fortnite."),("ko","Our backend has been restarted, please re-launch Fortnite."),("pl","Our backend has been restarted, please re-launch Fortnite."),("pt-BR","Our backend has been restarted, please re-launch Fortnite."),("ru","Our backend has been restarted, please re-launch Fortnite."),("tr","Our backend has been restarted, please re-launch Fortnite."),("zh-CN","Our backend has been restarted, please re-launch Fortnite."),("zh-Hant","Our backend has been restarted, please re-launch Fortnite.")))

+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="Fortnite.FortAthenaMatchmakingWidget", Key="Message.CanMatchmakeSolo", NativeString="PLAY!", LocalizedStrings=(("ar","READY"),("en","READY"),("de","READY"),("es","READY"),("es-419","READY"),("fr","READY"),("it","READY"),("ja","READY"),("ko","READY"),("pl","READY"),("pt-BR","READY"),("ru","READY"),("tr","READY"),("zh-CN","READY"),("zh-Hant","READY")))

+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="FortOnlineAccount", Key="CreatingParty", NativeString="Creating party...", LocalizedStrings=(("en","Hello player! Welcome to ${backendName}")))

+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="", Key="2A1C56D243E8C4418146029BA30A18F4", NativeString="Battle Pass", LocalizedStrings=(("en","Battle Pass")))

+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="PartyContext", Key="BattleRoyaleInLobby", NativeString="Battle Royale - In Lobby", LocalizedStrings=(("ar","Lobby"),("en","Lobby"),("de","Lobby"),("es","${backendName} - Lobby"),("es-419","${backendName} - Lobby"),("fr","${backendName} - Lobby"),("it","${backendName} - Lobby"),("ja","${backendName} - Lobby"),("ko","${backendName} - Lobby"),("pl","${backendName} - Lobby"),("pt-BR","${backendName} - Lobby"),("ru","${backendName} - Lobby"),("tr","${backendName} - Lobby"),("zh-CN","${backendName} - Lobby"),("zh-Hant","${backendName} - Lobby")))

+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="", Key="30C8C9204EAF7FF602BF51BA2914EF27", NativeString="EPIC PASSWORD", LocalizedStrings=(("en","${backendName} Password")))
+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="", Key="CA2EC1714F23111FDBE6439EBC961404", NativeString="EMAIL", LocalizedStrings=(("en","${backendName} Email")))

+TextReplacements=(Category=Game, bIsMinimalPatch=True, Namespace="", Key="40D1ADD648EDBD000A8F7E88E8D90341", NativeString="ITEM SHOP", LocalizedStrings=(("en","Item Shop")))


[/Script/FortniteGame.FortGameInstance]
KairosMinSupportedAppVersion=20
bBattleRoyaleMatchmakingEnabled=true
!FrontEndPlaylistData=ClearArray
FrontEndPlaylistData=(PlaylistName=Playlist_DefaultSolo, PlaylistAccess=(bEnabled=true, bIsDefaultPlaylist=false, bVisibleWhenDisabled=true, bDisplayAsNew=false, CategoryIndex=0, bDisplayAsLimitedTime=false, DisplayPriority=1))
+FrontEndPlaylistData=(PlaylistName=Playlist_DefaultDuo, PlaylistAccess=(bEnabled=false, bIsDefaultPlaylist=false, bVisibleWhenDisabled=true, bDisplayAsNew=false, CategoryIndex=0, bDisplayAsLimitedTime=false, DisplayPriority=2))
+FrontEndPlaylistData=(PlaylistName=Playlist_DefaultSquad, PlaylistAccess=(bEnabled=false, bIsDefaultPlaylist=false, bVisibleWhenDisabled=false, bDisplayAsNew=false, CategoryIndex=0, bDisplayAsLimitedTime=false, DisplayPriority=3))

; Arena
+FrontEndPlaylistData=(PlaylistName=Playlist_ShowdownAlt_Solo, PlaylistAccess=(bEnabled=True, bIsDefaultPlaylist=true, bVisibleWhenDisabled=true, bDisplayAsNew=True, CategoryIndex=1, bDisplayAsLimitedTime=false, DisplayPriority=4))
+ExperimentalBucketPercentList=(ExperimentNum=23,Name="BattlePassPurchaseScreen",BucketPercents=(0, 50, 50))

[/Script/FortniteGame.FortPlayerPawn]
NavLocationValidityDistance=500
MoveSoundStimulusBroadcastInterval=0.5
bCharacterPartsCastIndirectShadows=true

[/Script/FortniteGame.FortOnlineAccount]
bShouldAthenaQueryRecentPlayers=false
bDisablePurchasingOnRedemptionFailure=false

[/Script/FortniteGame.FortPlayerControllerAthena]
bNoInGameMatchmaking=true

[/Script/GameFeatures.GameFeaturesSubsystemSettings]
+DisabledPlugins=DiscoveryBrowser

[/Script/FortniteGame.FortChatManager]
bShouldRequestGeneralChatRooms=false
bShouldJoinGlobalChat=false
bShouldJoinFounderChat=false
bIsAthenaGlobalChatEnabled=true
RecommendChatFailureDelay=30
RecommendChatBackoffMultiplier=2.0
RecommendChatRandomWindow=120.0
RecommendChatFailureCountCap=7

[OnlinePartyEmbeddedCommunication]
bRetainPartyStateFields=false
bPerformAutoPromotion=true
InviteNotificationDelaySeconds=1.0

[/Script/Party.SocialSettings]
bMustSendPrimaryInvites=true
bLeavePartyOnDisconnect=false
bSetDesiredPrivacyOnLocalPlayerBecomesLeader=false
DefaultMaxPartySize=2

[/Script/Account.OnlineAccountCommon]
bEnableWaitingRoom=false
bRequireLightswitchAtStartup=false
AccessGrantDelaySeconds=0.0

[AssetHotfix]
+CurveTable=/Game/Athena/Balance/DataTables/AthenaGameData;RowUpdate;Default.SafeZone.Damage;0;0
`;

export const defaultinput = `
[/Script/Engine.InputSettings]
+ConsoleKeys=Tilde
+ConsoleKeys=F8
`;

export const defaultruntimeoptions = `
[/Script/FortniteGame.FortRuntimeOptions]
!DisabledFrontendNavigationTabs=ClearArray
+DisabledFrontendNavigationTabs=(TabName="AthenaStore",TabState=EFortRuntimeOptionTabState::Hidden)
+DisabledFrontendNavigationTabs=(TabName="AthenaChallenges",TabState=EFortRuntimeOptionTabState::Hidden)
+DisabledFrontendNavigationTabs=(TabName="AthenaCareer",TabState=EFortRuntimeOptionTabState::Hidden)
bEnableGlobalChat=false
bEnableMexiCola=true
bLoadDirectlyIntoLobby=true
bEnableInGameMatchmaking=true
MinimumAccountLevelForTournamentPlay=0
bSkipTrailerMovie=false
bAlwaysPlayTrailerMovie=false
bEnableSocialTab=true
!SocialRTInfo=ClearArray
+SocialRTInfo=(SlotId=1,StartsAtUTC=9999.08.06-22.00.00)
+SocialRTInfo=(SlotId=2,StartsAtUTC=9999.08.07-18.00.00)
+SocialRTInfo=(SlotId=3,StartsAtUTC=9999.08.08-04.00.00)
+SocialRTInfo=(SlotId=4,StartsAtUTC=9999.08.08-14.00.00)
+SocialRTInfo=(SlotId=5,StartsAtUTC=9999.08.08-22.00.00)
!ExperimentalCohortPercent=ClearArray
+ExperimentalCohortPercent=(CohortPercent=100,ExperimentNum=20)
ShowdownTournamentCacheExpirationHours=1
TournamentRefreshPlayerMaxRateSeconds=1
TournamentRefreshEventsMaxRateSeconds=1
TournamentRefreshPayoutMaxRateSeconds=1
`;

export default {
  defaultengine,
  defaultgame,
  defaultinput,
  defaultruntimeoptions,
};
