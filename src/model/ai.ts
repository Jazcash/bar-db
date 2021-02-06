import { BelongsToGetAssociationMixin, BelongsToSetAssociationMixin, Model, Optional } from "sequelize";

import { AllyTeamCreationAttributes, AllyTeamInstance } from "./ally-team";

export interface AI {
    id: number;
    aiId: number;
    shortName: string;
    name: string;
    host: boolean;
    startPos?: { x: number, y: number, z: number };
}

export interface AICreationAttributes extends Optional<AI, "id"> { }

export interface AIInstance extends Model<AI, AICreationAttributes>, AI {
    getAllyTeam: BelongsToGetAssociationMixin<AllyTeamInstance>;
    setAllyTeam: BelongsToSetAssociationMixin<AllyTeamInstance, AllyTeamInstance["id"]>;
    createAllyTeam: (allyTeam: AllyTeamCreationAttributes) => Promise<AllyTeamInstance>;
}