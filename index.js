const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require("discord.js"); const sqlite3 = require("sqlite3").verbose(); const cron = require("node-cron"); require("dotenv").config();

const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates ] });

const db = new sqlite3.Database("database.db", (err) => { if (err) console.error(err.message); else console.log("Connected to SQLite database."); });

// Creating necessary tables const tableQueries = [ CREATE TABLE IF NOT EXISTS missions ( guild_id TEXT, mission_name TEXT, mission_type TEXT, mission_goal INTEGER, reward TEXT ), CREATE TABLE IF NOT EXISTS user_progress ( user_id TEXT, guild_id TEXT, mission_name TEXT, progress INTEGER DEFAULT 0 ), CREATE TABLE IF NOT EXISTS nicknames ( guild_id TEXT PRIMARY KEY, format TEXT ) ];

tableQueries.forEach(query => db.run(query));

const commands = [ new SlashCommandBuilder() .setName("mission") .setDescription("Manage missions") .addSubcommand(subcommand => subcommand.setName("create") .setDescription("Create a new mission") .addStringOption(option => option.setName("name").setDescription("Mission name").setRequired(true)) .addStringOption(option => option.setName("type").setDescription("Type: chat/voice").setRequired(true)) .addIntegerOption(option => option.setName("goal").setDescription("Goal count").setRequired(true)) .addStringOption(option => option.setName("reward").setDescription("Reward (points/role)").setRequired(true)) ) .addSubcommand(subcommand => subcommand.setName("list") .setDescription("List all active missions") ) .addSubcommand(subcommand => subcommand.setName("reset") .setDescription("Reset a user's progress") .addUserOption(option => option.setName("user").setDescription("User to reset").setRequired(true)) ), new SlashCommandBuilder() .setName("setnicknameformat") .setDescription("Set or reset a custom format for new members’ nicknames") .addStringOption(option => option.setName("format").setDescription("Use {server} for the server name and {user} for the username.").setRequired(false)) .addBooleanOption(option => option.setName("disable").setDescription("Set to true to disable the custom nickname format.").setRequired(false)) ].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN); (async () => { try { console.log("Registering slash commands..."); await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands }); console.log("Slash commands registered."); } catch (error) { console.error(error); } })();

client.on("interactionCreate", async (interaction) => { if (!interaction.isCommand()) return;

const { commandName, options, guild } = interaction;

if (commandName === "setnicknameformat") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({
            content: "You need the **Manage Server** permission to use this command.",
            ephemeral: true
        });
    }

    const format = options.getString("format");
    const disable = options.getBoolean("disable");
    const newFormat = disable ? "{server} | {user}" : (format || "{server} | {user}");

    const confirmMessage = await interaction.reply({
        content: `Are you sure you want to ${disable ? "disable" : "set"} the nickname format to **\"${newFormat}\"**?`,
        components: [
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId("confirm_yes")
                        .setLabel("✅ Yes")
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId("confirm_no")
                        .setLabel("❌ No")
                        .setStyle(ButtonStyle.Danger)
                )
        ],
        ephemeral: true
    });

    const filter = i => i.user.id === interaction.user.id;
    const collector = confirmMessage.createMessageComponentCollector({ filter, time: 15000 });

    collector.on("collect", async (buttonInteraction) => {
        if (buttonInteraction.customId === "confirm_yes") {
            db.run("INSERT INTO nicknames (guild_id, format) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET format = ?", 
                [interaction.guild.id, newFormat, newFormat], 
                (err) => {
                    if (err) {
                        console.error(err);
                        return buttonInteraction.reply({ content: "There was an error saving the format.", ephemeral: true });
                    }
                    buttonInteraction.reply({ content: `The nickname format has been ${disable ? "disabled" : "set to"} **\"${newFormat}\"**!`, ephemeral: true });
                }
            );
        } else if (buttonInteraction.customId === "confirm_no") {
            buttonInteraction.reply({ content: "Nickname format change cancelled.", ephemeral: true });
        }
    });
}

});

client.once("ready", () => { console.log(`Logged in as ${client.user.tag}`); });

client.login(process.env.TOKEN);

