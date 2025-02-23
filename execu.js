const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [/* List of your command objects */];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Refreshing slash commands...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('Slash commands updated.');
    } catch (error) {
        console.error('Error updating commands:', error);
    }
})();
