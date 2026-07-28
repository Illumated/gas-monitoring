const adminUser = process.env.NODE_RED_ADMIN_USER || "admin";
const adminPasswordHash = process.env.NODE_RED_ADMIN_PASSWORD_HASH || "";
const credentialSecret = process.env.NODE_RED_CREDENTIAL_SECRET;

if (!credentialSecret) {
    throw new Error("NODE_RED_CREDENTIAL_SECRET is required");
}

const settings = {
    uiPort: process.env.PORT || 1880,
    flowFile: process.env.FLOWS || "flows.json",
    credentialSecret,
    contextStorage: {
        default: {
            module: "localfilesystem"
        }
    },
    functionGlobalContext: {
        crypto: require("node:crypto")
    },
    diagnostics: {
        enabled: true,
        ui: false
    },
    runtimeState: {
        enabled: true,
        ui: false
    },
    externalModules: {
        autoInstall: false,
        palette: {
            allowInstall: false,
            allowUpload: false
        },
        modules: {
            allowInstall: false
        }
    },
    functionExternalModules: false,
    exportGlobalContextKeys: false,
    editorTheme: {
        projects: {
            enabled: false
        }
    },
    logging: {
        console: {
            level: "info",
            metrics: false,
            audit: false
        }
    }
};

if (adminPasswordHash) {
    settings.adminAuth = {
        type: "credentials",
        users: [
            {
                username: adminUser,
                password: adminPasswordHash,
                permissions: "*"
            }
        ]
    };
}

module.exports = settings;
