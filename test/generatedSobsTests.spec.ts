// tslint:disable:no-unused-expression
import { UsernamePasswordConfig, setDefaultConfig, OAuth } from 'ts-force';
import { suite, test, slow, timeout } from 'mocha-typescript';
import { should, assert, expect } from 'chai';
import { Account, Contact } from './generatedSobs';
import { CompositeCollection } from 'ts-force';
import { cleanAPIName } from '../src/util';

@suite class PasswordConfigTest {
     async before () {
        const passwordConfig = new UsernamePasswordConfig(process.env.CLIENT_ID, process.env.CLIENT_SECRET, process.env.HOST, process.env.USERNAME, process.env.PASSWORD);
        let oAuth = new OAuth(passwordConfig);
        setDefaultConfig(await oAuth.initialize());

    }

    @test async 'RestObject: Sanitize Names' () {
        expect(cleanAPIName('My_Test_Object__c')).to.equal('MyTestObject');
        expect(cleanAPIName('My_Test_Relation__r')).to.equal('MyTestRelation');
        expect(cleanAPIName('My__Test_Object__r')).to.equal('MyTestObject');
    }

    @test async 'RestObject: DML End-to-End' () {
        let acc = new Account({
            name: 'test account'
        });
        await acc.insert();
        expect(acc.id).to.not.be.null;

        acc.name = 'test name 2';
        await acc.update();

        let acc2 = (await Account.retrieve(`SELECT Name FROM Account WHERE Id = '${acc.id}'`))[0];

        expect(acc2.name).to.equal(acc.name);

        await acc.delete();

        let accounts = await Account.retrieve(`SELECT Name FROM Account WHERE Id = '${acc.id}'`);
        expect(accounts.length).to.equal(0);
    }

    @test async 'RestObject: refresh' () {
        let acc = new Account({
            name: 'test account',
            website: 'www.facepamplet.com'
        });
        await acc.insert();

        let acc2 = (await Account.retrieve(`SELECT Id FROM Account WHERE Id = '${acc.id}'`))[0];
        acc.name = 'test name 2';
        await acc2.update(true);

        expect(acc2.website).to.equal(acc.website);

        await acc.delete();
    }

    @test async 'RestObject: Collections End-to-End' () {
        let acc = new Account({
            name: 'test account'
        });
        await acc.insert();

        let contacts = [];
        const contactSize = 50;
        for (let i = 0; i < contactSize; i++) {
            contacts.push(new Contact({
                accountId: acc.id,
                firstName: `test`,
                lastName: `contact ${i}`
            }));
        }

        let bulk = new CompositeCollection();
        await bulk.insert(contacts);

        acc = (await Account.retrieve(`SELECT Id, (SELECT ${Contact.FIELDS.name.apiName} FROM ${Account.FIELDS.contacts.apiName}) FROM Account WHERE Id = '${acc.id}'`))[0];

        expect(acc.contacts.length).to.equal(contactSize);

        acc.contacts.forEach(c => {
            c.email = 'test@example.com';
        });

        await bulk.update(contacts);

        acc.contacts.forEach(c => {
            expect(c.email).to.equal('test@example.com');
        });

        await bulk.delete(contacts);

        acc = (await Account.retrieve(`SELECT Id, (SELECT ${Contact.FIELDS.name.apiName} FROM ${Account.FIELDS.contacts.apiName}) FROM Account WHERE Id = '${acc.id}'`))[0];

        expect(acc.contacts.length).to.equal(0);

        await acc.delete();
    }
}
