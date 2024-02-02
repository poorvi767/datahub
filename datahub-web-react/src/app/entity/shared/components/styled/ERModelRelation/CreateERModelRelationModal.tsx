import React, { useState } from 'react';
import { Button, Form, Input, message, Modal, Table } from 'antd';
import TextArea from 'antd/lib/input/TextArea';
import { PlusOutlined } from '@ant-design/icons';
import arrow from '../../../../../../images/Arrow.svg';
import './CreateERModelRelationModal.less';
import { EntityType, ErModelRelation, OwnerEntityType } from '../../../../../../types.generated';
import { useCreateErModelRelationMutation, useUpdateErModelRelationMutation } from '../../../../../../graphql/ermodelrelation.generated';
import { useUserContext } from '../../../../../context/useUserContext';
import { EditableRow } from './EditableRow';
import { EditableCell } from './EditableCell';
import { checkDuplicateERModelRelation, getDatasetName, ERModelRelationDataType, validateERModelRelation } from './ERModelRelationUtils';
import { useGetSearchResultsQuery } from '../../../../../../graphql/search.generated';
import { useAddOwnerMutation } from '../../../../../../graphql/mutations.generated';

type Props = {
    table1?: any;
    table1Schema?: any;
    table2?: any;
    table2Schema?: any;
    visible: boolean;
    setModalVisible?: any;
    onCancel: () => void;
    editERModelRelation?: ErModelRelation;
    isEditing?: boolean;
    refetch: () => Promise<any>;
};

type EditableTableProps = Parameters<typeof Table>[0];
type ColumnTypes = Exclude<EditableTableProps['columns'], undefined>;

export const CreateERModelRelationModal = ({
    table1,
    table1Schema,
    table2,
    table2Schema,
    visible,
    setModalVisible,
    onCancel,
    editERModelRelation,
    isEditing,
    refetch,
}: Props) => {
    const [form] = Form.useForm();
    const { user } = useUserContext();
    const ownerEntityType =
        user && user.type === EntityType.CorpGroup ? OwnerEntityType.CorpGroup : OwnerEntityType.CorpUser;
    const table1Dataset = editERModelRelation?.properties?.datasetA || table1?.dataset;
    const table1DatasetSchema = editERModelRelation?.properties?.datasetA || table1Schema;
    const table2Dataset = editERModelRelation?.properties?.datasetB || table2?.dataset;
    const table2DatasetSchema = editERModelRelation?.properties?.datasetB || table2Schema?.dataset;

    const [details, setDetails] = useState<string>(editERModelRelation?.editableProperties?.description || '');
    const [ermodelrelationName, setERModelRelationName] = useState<string>(
        editERModelRelation?.editableProperties?.name || editERModelRelation?.properties?.name || editERModelRelation?.ermodelrelationId || '',
    );
    const [tableData, setTableData] = useState<ERModelRelationDataType[]>(
        editERModelRelation?.properties?.ermodelrelationFieldMapping?.fieldMappings?.map((item, index) => {
            return {
                key: index,
                field1Name: item.afield,
                field2Name: item.bfield,
            };
        }) || [
            { key: '0', field1Name: '', field2Name: '' },
            { key: '1', field1Name: '', field2Name: '' },
        ],
    );
    const [count, setCount] = useState(editERModelRelation?.properties?.ermodelrelationFieldMapping?.fieldMappings?.length || 2);
    const [createMutation] = useCreateErModelRelationMutation();
    const [updateMutation] = useUpdateErModelRelationMutation();
    const [addOwnerMutation] = useAddOwnerMutation();
    const { refetch: getSearchResultsERModelRelations } = useGetSearchResultsQuery({
        skip: true,
    });

    const handleDelete = (record) => {
        const newData = tableData.filter((item) => item.key !== record.key);
        setTableData(newData);
    };
    const onCancelSelect = () => {
        Modal.confirm({
            title: `Exit`,
            className: 'cancel-modal',
            content: `Are you sure you want to exit?  The changes made to the ermodelrelation will not be applied.`,
            onOk() {
                setERModelRelationName(editERModelRelation?.properties?.name || '');
                setDetails(editERModelRelation?.editableProperties?.description || '');
                setTableData(
                    editERModelRelation?.properties?.ermodelrelationFieldMapping?.fieldMappings?.map((item, index) => {
                        return {
                            key: index,
                            field1Name: item.afield,
                            field2Name: item.bfield,
                        };
                    }) || [
                        { key: '0', field1Name: '', field2Name: '' },
                        { key: '1', field1Name: '', field2Name: '' },
                    ],
                );
                setCount(editERModelRelation?.properties?.ermodelrelationFieldMapping?.fieldMappings?.length || 2);
                onCancel?.();
            },
            onCancel() {},
            okText: 'Yes',
            maskClosable: true,
            closable: true,
        });
    };
    const createERModelRelation = () => {
        createMutation({
            variables: {
                input: {
                    properties: {
                        dataSetA: table1Dataset?.urn || '',
                        datasetB: table2Dataset?.urn || '',
                        name: ermodelrelationName,
                        ermodelrelationFieldmapping: {
                            fieldMappings: tableData.map((r) => {
                                return {
                                    afield: r.field1Name,
                                    bfield: r.field2Name,
                                };
                            }),
                        },
                        created: true,
                    },
                    editableProperties: {
                        name: ermodelrelationName,
                        description: details,
                    },
                },
            },
        })
            .then(({ data }) => {
                message.loading({
                    content: 'Create...',
                    duration: 2,
                });
                setTimeout(() => {
                    refetch();
                    message.success({
                        content: `ERModelRelation created!`,
                        duration: 2,
                    });
                }, 2000);
                addOwnerMutation({
                    variables: {
                        input: {
                            ownerUrn: user?.urn || '',
                            resourceUrn: data?.createERModelRelation?.urn || '',
                            ownershipTypeUrn: 'urn:li:ownershipType:__system__technical_owner',
                            ownerEntityType: ownerEntityType || EntityType,
                        },
                    },
                });
            })
            .catch((e) => {
                message.destroy();
                message.error({ content: `Failed to create ermodelrelation: ${e.message || ''}`, duration: 3 });
            });
    };
    const originalERModelRelationName = editERModelRelation?.properties?.name;
    const updateERModelRelation = () => {
        updateMutation({
            variables: {
                urn: editERModelRelation?.urn || '',
                input: {
                    properties: {
                        dataSetA: table1Dataset?.urn || '',
                        datasetB: table2Dataset?.urn || '',
                        name: originalERModelRelationName || '',
                        createdBy: editERModelRelation?.properties?.createdActor?.urn || user?.urn,
                        createdAt: editERModelRelation?.properties?.createdTime || 0,
                        ermodelrelationFieldmapping: {
                            fieldMappings: tableData.map((r) => {
                                return {
                                    afield: r.field1Name,
                                    bfield: r.field2Name,
                                };
                            }),
                        },
                    },
                    editableProperties: {
                        name: ermodelrelationName,
                        description: details,
                    },
                },
            },
        })
            .then(() => {
                message.loading({
                    content: 'updating...',
                    duration: 2,
                });
                setTimeout(() => {
                    refetch();
                    message.success({
                        content: `ERModelRelation updated!`,
                        duration: 2,
                    });
                }, 2000);
            })
            .catch((e) => {
                message.destroy();
                message.error({ content: `Failed to update ermodelrelation: ${e.message || ''}`, duration: 3 });
            });
    };
    const onSubmit = async () => {
        const errors = validateERModelRelation(ermodelrelationName, tableData, isEditing, getSearchResultsERModelRelations);
        if ((await errors).length > 0) {
            const err = (await errors).join(`, `);
            message.error(err);
            return;
        }
        if (isEditing) {
            updateERModelRelation();
        } else {
            createERModelRelation();
            setERModelRelationName('');
            setDetails('');
            setTableData([
                { key: '0', field1Name: '', field2Name: '' },
                { key: '1', field1Name: '', field2Name: '' },
            ]);
            setCount(2);
        }
        setModalVisible(false);
    };

    const table1NameBusiness = getDatasetName(table1Dataset);
    const table1NameTech = table1Dataset?.name || table1Dataset?.urn.split(',').at(1) || '';
    const table2NameBusiness = getDatasetName(table2Dataset);
    const table2NameTech = table2Dataset?.name || table2Dataset?.urn.split(',').at(1) || '';

    const handleAdd = () => {
        const newData: ERModelRelationDataType = {
            key: count,
            field1Name: '',
            field2Name: '',
        };
        setTableData([...tableData, newData]);
        setCount(count + 1);
    };
    const defaultColumns: (ColumnTypes[number] & { editable?: boolean; dataIndex: string; tableRecord?: any })[] = [
        {
            title: (
                <p className="titleContent">
                    <div className="firstRow">
                        <span className="titleNameDisplay"> {table1NameBusiness || table1NameTech}</span>
                    </div>
                    <div className="editableNameDisplay">{table1NameTech !== table1NameBusiness && table1NameTech}</div>
                </p>
            ),
            dataIndex: 'field1Name',
            tableRecord: table1DatasetSchema || {},
            editable: true,
        },
        {
            title: '',
            dataIndex: '',
            editable: false,
            render: () => <img src={arrow} alt="" />,
        },
        {
            title: (
                <p className="titleContent">
                    <div className="firstRow">
                        <span className="titleNameDisplay"> {table2NameBusiness || table2NameTech}</span>
                    </div>
                    <div className="editableNameDisplay">{table2NameTech !== table2NameBusiness && table2NameTech}</div>
                </p>
            ),
            dataIndex: 'field2Name',
            tableRecord: table2DatasetSchema || {},
            editable: true,
        },
        {
            title: 'Action',
            dataIndex: '',
            editable: false,
            render: (record) =>
                tableData.length > 1 ? (
                    <Button type="link" onClick={() => handleDelete(record)}>
                        Delete
                    </Button>
                ) : null,
        },
    ];
    const handleSave = (row: ERModelRelationDataType) => {
        const newData = [...tableData];
        const index = newData.findIndex((item) => row.key === item.key);
        const item = newData[index];
        newData.splice(index, 1, {
            ...item,
            ...row,
        });
        setTableData(newData);
    };
    const components = {
        body: {
            row: EditableRow,
            cell: EditableCell,
        },
    };

    const columns = defaultColumns.map((col) => {
        if (!col.editable) {
            return col;
        }
        return {
            ...col,
            onCell: (record: ERModelRelationDataType) => ({
                record,
                editable: col.editable,
                dataIndex: col.dataIndex,
                tableRecord: col.tableRecord,
                title: col.title,
                handleSave,
            }),
        };
    });
    return (
        <Modal
            title={
                <div className="footer-parent-div">
                    <p className="ermodelrelation-title">ERModelRelation parameters</p>
                    <div>
                        <Button onClick={onCancelSelect} className="cancel-btn" size="large">
                            Cancel
                        </Button>
                    </div>
                    <div>
                        <Button className="submit-btn" size="large" id="continueButton" onClick={onSubmit}>
                            Submit
                        </Button>
                    </div>
                </div>
            }
            visible={visible}
            closable={false}
            className="CreateERModelRelationModal"
            okButtonProps={{ hidden: true }}
            cancelButtonProps={{ hidden: true }}
            onCancel={onCancelSelect}
            destroyOnClose
        >
            <div className="inner-div">
                <p className="all-table-heading">Table 1</p>
                <p className="all-information">{table1NameBusiness}</p>
                <div className="techNameDisplay">{table1NameTech !== table1NameBusiness && table1NameTech}</div>
                <p className="all-content-heading">Table 2</p>
                <p className="all-information">{table2NameBusiness}</p>
                <div className="techNameDisplay">{table2NameTech !== table2NameBusiness && table2NameTech}</div>
                <p className="all-content-heading">ERModelRelation name</p>
                <Form
                    form={form}
                    layout="vertical"
                    fields={[
                        { name: 'ermodelrelationNameForm', value: ermodelrelationName },
                        { name: 'ermodelrelationDetails', value: details },
                    ]}
                    onFinish={onSubmit}
                >
                    <Form.Item
                        style={{ margin: 0 }}
                        name="ermodelrelationNameForm"
                        rules={[
                            {
                                required: true,
                                message: `ERModelRelation name is required.`,
                            },
                            {
                                validator: (_, value) =>
                                    checkDuplicateERModelRelation(getSearchResultsERModelRelations, value?.trim()).then((result) => {
                                        return result === true && !isEditing
                                            ? Promise.reject(
                                                  new Error(
                                                      'This ermodelrelation name already exists. A unique name for each ermodelrelation is required.',
                                                  ),
                                              )
                                            : Promise.resolve();
                                    }),
                            },
                        ]}
                    >
                        <Input size="large" className="ermodelrelation-name" onChange={(e) => setERModelRelationName(e.target.value)} />
                    </Form.Item>
                    <p className="all-content-heading">Fields</p>
                    <Table
                        bordered
                        components={components}
                        dataSource={tableData}
                        className="ERModelRelationTable"
                        columns={columns as ColumnTypes}
                        pagination={false}
                    />
                    <Button type="link" className="add-btn-link" onClick={handleAdd}>
                        <PlusOutlined /> Add Row
                    </Button>
                    <p className="all-content-heading">ERModelRelation details</p>
                    <Form.Item style={{ margin: 0 }} name="ermodelrelationDetails">
                        <TextArea
                            className="ermodelrelation-details-ta"
                            placeholder="Please enter ermodelrelation details here"
                            onChange={(e) => setDetails(e.target.value)}
                        />
                    </Form.Item>
                </Form>
            </div>
        </Modal>
    );
};
