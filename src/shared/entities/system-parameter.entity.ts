import { Column, Entity, PrimaryGeneratedColumn, Index } from "typeorm";

@Entity()
@Index(['interface_name', 'parameter_name'], { unique: true })
export class SystemParameter {
    @PrimaryGeneratedColumn('increment')
    id: number;
    
    @Column('text', { 
        nullable: false,
    })
    interface_name: string;

    @Column('text', { 
        nullable: false,
    })
    parameter_name: string;

    @Column('text', { 
        nullable: true,
    })
    parameter_value: string;

    @Column('text', { 
        nullable: true,
    })
    description: string;

    @Column({ 
        type: 'timestamp',
        nullable: true,
    })
    CreatedDate: Date;

    @Column('numeric', { 
        nullable: true,
    })
    CreatedUser: number;

    @Column({
        type: 'timestamp', 
        nullable: true,
    })
    ModifiedDate: Date;

    @Column('numeric', { 
        nullable: true,
    })
    ModifiedUser: number;
}
