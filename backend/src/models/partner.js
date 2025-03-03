module.exports = (sequelize, DataTypes) => {
    const Partner = sequelize.define(
        'Partner',
        {
            id: {
            // Perlu dicatat: SQLite tidak mendukung UNSIGNED, sehingga akan menggunakan plain INTEGER
            type: DataTypes.INTEGER, 
            autoIncrement: true,
            primaryKey: true,
            },
            uuid: {
            type: DataTypes.STRING(45),
            unique: true,
            allowNull: true,
            defaultValue: null,
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
            allowNull: true,
            defaultValue: null,
            },
            code: {
            type: DataTypes.STRING(45),
            allowNull: true,
            defaultValue: null,
            },
            role: {
            type: DataTypes.STRING(100),
            allowNull: true,
            defaultValue: null,
            },
            phone_number: {
            type: DataTypes.STRING(20),
            allowNull: true,
            defaultValue: null,
            },
            menu: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null,
            },
            auth: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null,
            },
            config: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null,
            },
            data_expiry_day: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 7,
            },
            client_id: {
            type: DataTypes.STRING(45),
            allowNull: true,
            defaultValue: null,
            },
            client_secret: {
            type: DataTypes.STRING(45),
            allowNull: true,
            defaultValue: null,
            },
            two_factor_authentication: {
            type: DataTypes.ENUM('none', 'active', 'inactive'),
            allowNull: false,
            defaultValue: 'none',
            validate: {
                isIn: {
                args: [['none', 'active', 'inactive']],
                msg: 'Invalid value for two_factor_authentication',
                },
            },
            },
            secret: {
            type: DataTypes.STRING(20),
            allowNull: true,
            defaultValue: null,
            },
            status: {
            type: DataTypes.ENUM('pending', 'approved'),
            allowNull: false,
            defaultValue: 'pending',
            validate: {
                isIn: {
                args: [['pending', 'approved']],
                msg: 'Invalid value for status',
                },
            },
            },
            created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            },
            updated_at: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
            },
            deleted_at: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
            },
            last_login_at: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
            },
            password_expired_at: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: null,
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
    