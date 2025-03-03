module.exports = (sequelize, DataTypes) => {
    const Partner = sequelize.define(
        'Partner',
        {
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            uuid: {
                type: DataTypes.STRING(45),
                unique: true,
            },
            email: {
                type: DataTypes.STRING(50),
                allowNull: false,
                validate: {
                    isEmail: true,
                },
            },
            password: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            company_name: {
                type: DataTypes.STRING(255),
            },
            code: {
                type: DataTypes.STRING(45),
            },
            role: {
                type: DataTypes.STRING(100),
            },
            phone_number: {
                type: DataTypes.STRING(20),
            },
            menu: {
                type: DataTypes.JSON,
            },
            auth: {
                type: DataTypes.JSON,
            },
            config: {
                type: DataTypes.JSON,
            },
            data_expiry_day: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 7,
            },
            client_id: {
                type: DataTypes.STRING(45),
            },
            client_secret: {
                type: DataTypes.STRING(45),
            },
            two_factor_authentication: {
                type: DataTypes.ENUM('none', 'active', 'inactive'),
                allowNull: false,
                defaultValue: 'none',
            },
            secret: {
                type: DataTypes.STRING(20),
            },
            status: {
                type: DataTypes.ENUM('pending', 'approved'),
                allowNull: false,
                defaultValue: 'pending',
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            updated_at: {
                type: DataTypes.DATE,
            },
            deleted_at: {
                type: DataTypes.DATE,
            },
            last_login_at: {
                type: DataTypes.DATE,
            },
            password_expired_at: {
                type: DataTypes.DATE,
            },
        },
        {
            tableName: 'partner',
            timestamps: false,
            underscored: true,
        }
    );

    return Partner;
};
